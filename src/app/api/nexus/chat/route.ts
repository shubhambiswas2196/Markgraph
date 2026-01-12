import { NextRequest } from 'next/server';
import { nexusAgent } from '@/lib/nexus/agent';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, userId, chatId, accountId, spreadsheetId } = body;
        console.log("Nexus Chat Request:", { userId, chatId, messageCount: messages?.length });

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Messages array is required' }), { status: 400 });
        }

        // With MemorySaver, we only send the NEWEST message. 
        // The checkpointer automatically restores the rest of the conversation.
        const lastMsg = messages[messages.length - 1];
        const langChainMessages = lastMsg.role === 'assistant'
            ? [new AIMessage(lastMsg.content)]
            : [new HumanMessage(lastMsg.content)];

        // Use streamEvents with configurable context and thread_id
        const eventStream = nexusAgent.streamEvents(
            {
                messages: langChainMessages,
                accountId: accountId || undefined,
                spreadsheetId: spreadsheetId || undefined
            },
            {
                version: "v2",
                recursionLimit: 100,
                configurable: {
                    userId: userId || 0,
                    thread_id: chatId || `user_${userId || 'guest'}`
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

                        // 2. Capture Router/Supervisor Reasoning
                        else if (eventType === "on_chain_end" && (event.name === "supervisor" || event.name === "router")) {
                            const output = event.data.output;
                            if (output && output.next) {
                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'supervisor_decision',
                                    next: output.next,
                                    reasoning: output.reasoning
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
                    }
                    controller.close();
                } catch (e: any) {
                    console.error("Stream Error Detailed:", {
                        message: e.message,
                        status: e.status,
                        headers: e.headers,
                        errorData: e.error || e.data
                    });
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
