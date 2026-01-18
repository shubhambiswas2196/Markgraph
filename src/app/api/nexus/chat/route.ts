import { NextRequest } from 'next/server';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        // Extract userId from JWT token
        const authenticatedUserId = await getUserIdFromRequest(request);

        const body = await request.json();
        const { messages, spreadsheetId, approvalDecision } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Messages array is required' }), { status: 400 });
        }

        // 1. REPLACED DB MEMORY WITH LANGCHAIN CONVERSATION BUFFER MEMORY
        // We initialize the memory state from the request payload (stateless architecture)
        const pastMessages = messages.slice(0, -1).map((m: any) =>
            m.role === 'assistant' ? new AIMessage(m.content) :
                m.role === 'tool' ? new HumanMessage(`[Tool Result]: ${m.content}`) : // Simplify tool results for buffer
                    new HumanMessage(m.content)
        );

        const historyMessages = pastMessages;

        // Get the new user message
        const lastMsg = messages[messages.length - 1];
        const newUserMessage = new HumanMessage(lastMsg.content);

        const allMessages = [...historyMessages, newUserMessage];

        // Always use Deep Reasoning Agent
        console.log("🚀 Engaging Deep Reasoning Agent (Stateless Mode)");
        const { deepReasoningGraph } = await import('@/lib/nexus/deep-agent');

        let eventStream = deepReasoningGraph.streamEvents(
            {
                messages: allMessages,
                plan: [],
                todo_list: [],
                subagent_reports: [],
                currentStep: "START",
                pendingPermission: approvalDecision === 'pending',
                permissionGranted: approvalDecision === 'approved',
                cachedToolResults: {},
                spreadsheetId: spreadsheetId || ""
            },
            {
                version: "v2",
                recursionLimit: 150,
                configurable: {
                    userId: authenticatedUserId,
                    thread_id: `stateless_${authenticatedUserId}`
                }
            } as any
        );

        const encoder = new TextEncoder();

        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of eventStream) {
                        const eventType = event.event;

                        // 1. Stream text chunks ONLY from workers (not supervisor)
                        if (eventType === "on_chat_model_stream") {
                            const isWorker = event.metadata?.agentTag === "worker";
                            if (isWorker) {
                                const chunk = event.data.chunk;
                                if (chunk?.content) {
                                    controller.enqueue(encoder.encode(JSON.stringify({
                                        type: 'text',
                                        content: chunk.content
                                    }) + '\n'));
                                }
                            }
                        }

                        // 2. Capture Router/Supervisor/Planner Reasoning
                        else if (eventType === "on_chain_end" && (event.name === "supervisor" || event.name === "router" || event.name === "planner")) {
                            const output = event.data.output;

                            // Planner specific output
                            if (event.name === "planner" && output?.plan) {
                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'supervisor_decision',
                                    next: 'analyst',
                                    reasoning: `**Plan Created:**\n${output.plan.join('\n')}`
                                }) + '\n'));
                            }
                            // Supervisor/Router/Analyst output
                            else if (output) {
                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'supervisor_decision',
                                    next: output.next || (event.name === 'analyst' ? 'tools' : undefined),
                                    reasoning: output.reasoning,
                                    todo_list: output.todo_list
                                }) + '\n'));
                            }
                        }

                        // 3. Tool Logs
                        else if (eventType === "on_tool_start") {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                type: 'tool_start',
                                tool: event.name
                            }) + '\n'));
                        } else if (eventType === "on_tool_end") {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                type: 'tool_end',
                                tool: event.name,
                                output: event.data.output
                            }) + '\n'));
                        }

                        // 4. Detect approval requests from state changes
                        else if (eventType === "on_chain_end" && event.name === "approvalChecker") {
                            const output = event.data.output;
                            if (output?.pendingApproval) {
                                console.log('[Chat API] Approval required detected');
                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'approval_required',
                                    approval: output.pendingApproval
                                }) + '\n'));
                            }
                        }
                    }

                    controller.close();
                } catch (e: any) {
                    console.error("Stream Error Detailed:", e);
                    controller.enqueue(encoder.encode(JSON.stringify({
                        type: 'error',
                        content: e.message,
                        status: e.status
                    }) + '\n'));
                    controller.close();
                }
            }
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error: any) {
        console.error('Nexus AI Chat Error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to get response from Nexus AI',
            details: error.message
        }), { status: 500 });
    }
}
