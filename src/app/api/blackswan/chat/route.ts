import { NextRequest } from 'next/server';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        // Extract userId from JWT token
        const authenticatedUserId = await getUserIdFromRequest(request);

        const body = await request.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Messages array is required' }), { status: 400 });
        }

        // Initialize memory from request payload (stateless architecture)
        const pastMessages = messages.slice(0, -1).map((m: any) =>
            m.role === 'assistant' ? new AIMessage(m.content) :
                m.role === 'tool' ? new HumanMessage(`[Tool Result]: ${m.content}`) :
                    new HumanMessage(m.content)
        );

        const historyMessages = pastMessages;
        const lastMsg = messages[messages.length - 1];
        const newUserMessage = new HumanMessage(lastMsg.content);
        const allMessages = [...historyMessages, newUserMessage];

        // Import the Simple Agent
        console.log("🚀 Engaging Blackswan Simple Agent");
        const { simpleAgentGraph } = await import('@/lib/blackswan/simple-agent');

        let eventStream = simpleAgentGraph.streamEvents(
            {
                messages: allMessages,
            },
            {
                version: "v2",
                recursionLimit: 50,
                configurable: {
                    userId: authenticatedUserId,
                    thread_id: `blackswan_${authenticatedUserId}`
                }
            } as any
        );

        const readableStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                const safeEnqueue = (data: string) => {
                    try {
                        controller.enqueue(encoder.encode(data));
                    } catch (e) {
                        // Ignore error if controller is closed/errored
                    }
                };

                try {
                    for await (const event of eventStream) {
                        if (request.signal.aborted) {
                            controller.close();
                            return;
                        }

                        const eventType = event.event;

                        // 1. Stream text chunks from the model
                        if (eventType === "on_chat_model_stream") {
                            if (event.metadata?.langgraph_node === 'agent') {
                                const chunk = event.data.chunk;
                                if (chunk?.content) {
                                    safeEnqueue(JSON.stringify({
                                        type: 'text',
                                        content: chunk.content
                                    }) + '\n');
                                }
                            }
                        }

                        // 2. Tool Logs
                        else if (eventType === "on_tool_start") {
                            safeEnqueue(JSON.stringify({
                                type: 'tool_start',
                                tool: event.name,
                                input: event.data.input
                            }) + '\n');
                        } else if (eventType === "on_tool_end") {
                            safeEnqueue(JSON.stringify({
                                type: 'tool_end',
                                tool: event.name,
                                output: event.data.output
                            }) + '\n');
                        }
                    }

                    try {
                        controller.close();
                    } catch (e) {
                        // ignore if already closed
                    }
                } catch (e: any) {
                    // Only log if it's not a disconnect/abort error
                    if (!e.message?.includes('closed') && !e.message?.includes('abort')) {
                        console.error("Stream Error Detailed:", e);
                    }

                    try {
                        safeEnqueue(JSON.stringify({
                            type: 'error',
                            content: e.message || "Stream interrupted",
                            status: e.status || 500
                        }) + '\n');
                        controller.close();
                    } catch (closeError) {
                        // ignore
                    }
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
        console.error('Blackswan AI Chat Error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to get response from Blackswan AI',
            details: error.message
        }), { status: 500 });
    }
}
