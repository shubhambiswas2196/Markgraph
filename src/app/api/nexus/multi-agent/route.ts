import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { getUserIdFromRequest } from '@/lib/auth';
import { multiAgentGraph } from '@/lib/nexus/multi-agent';


export async function POST(request: NextRequest) {
    try {
        // Extract userId from JWT token
        const authenticatedUserId = await getUserIdFromRequest(request);

        const body = await request.json();
        const { messages, mode = 'multi-agent' } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Messages array is required' }), { status: 400 });
        }

        console.log(`[Multi-Agent] Starting for user ${authenticatedUserId}`);



        const thread_id = `multi_user_${authenticatedUserId}`;

        // Convert frontend messages to LangChain messages
        const history: BaseMessage[] = messages.slice(0, -1).map((m: any) =>
            m.role === 'assistant' ? new AIMessage(m.content) : new HumanMessage(m.content)
        );
        const lastMessage = messages[messages.length - 1];
        const humanMessage = new HumanMessage(lastMessage.content);

        const initialMessages = [...history, humanMessage];

        const encoder = new TextEncoder();

        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    // Stream events from the multi-agent graph
                    for await (const event of multiAgentGraph.streamEvents(
                        {
                            messages: initialMessages,
                            currentAgent: "alex",
                            agentHistory: [],
                            finalResponse: ""
                        },
                        {
                            version: "v2",
                            recursionLimit: 150,
                            configurable: {
                                userId: authenticatedUserId,
                                thread_id: thread_id
                            }
                        } as any
                    )) {
                        const eventType = event.event;

                        // Stream agent transitions & Supervisor Decisions
                        if (eventType === "on_chain_end" && event.name === "alex") {
                            const output = event.data.output;
                            const lastMsg = output.messages?.[output.messages.length - 1];
                            const reasoning = lastMsg?.content || "Routing request...";

                            let nextAgent = "alex";
                            if (output.currentAgent === "google_ads_agent") nextAgent = "GOOGLE_AGENT";
                            else if (output.currentAgent === "meta_ads_agent") nextAgent = "META_AGENT";
                            else if (output.currentAgent === "sheets_agent") nextAgent = "SHEETS_AGENT";

                            controller.enqueue(encoder.encode(JSON.stringify({
                                type: 'supervisor_decision',
                                next: nextAgent,
                                reasoning: reasoning,
                                clearContent: nextAgent !== 'alex' // Clear preliminary text if we are routing
                            }) + '\n'));
                        }

                        // Stream agent transitions (for logging)
                        if (eventType === "on_chain_start" && event.name) {
                            const agentName = event.name;
                            if (["alex", "google_ads_agent", "meta_ads_agent", "sheets_agent", "synthesize"].includes(agentName)) {
                                let displayName = agentName;
                                if (agentName === "google_ads_agent") displayName = "Google Ads Agent";
                                else if (agentName === "meta_ads_agent") displayName = "Meta Ads Agent";
                                else if (agentName === "sheets_agent") displayName = "Sheets Agent";
                                else if (agentName === "alex") displayName = "Alex";

                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'agent_transition',
                                    agent: agentName,
                                    message: `Switching to ${displayName}`
                                }) + '\n'));
                            }
                        }

                        // Stream text chunks from agents
                        if (eventType === "on_chat_model_stream") {
                            const chunk = event.data.chunk;
                            if (chunk?.content) {
                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'text',
                                    content: chunk.content,
                                    agent: event.metadata?.agentTag || 'unknown'
                                }) + '\n'));
                            }
                        }

                        // Stream tool calls
                        if (eventType === "on_tool_start") {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                type: 'tool_start',
                                tool: event.name,
                                agent: event.metadata?.agentTag || 'unknown'
                            }) + '\n'));
                        }

                        // Stream tool results
                        if (eventType === "on_tool_end") {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                type: 'tool_end',
                                tool: event.name,
                                result: event.data.output,
                                agent: event.metadata?.agentTag || 'unknown'
                            }) + '\n'));
                        }

                        // Stream final response (cleanup)
                        if (eventType === "on_chain_end" && event.name === "synthesize") {
                            const output = event.data.output;
                            if (output?.finalResponse) {
                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'final_response',
                                    content: output.finalResponse
                                }) + '\n'));
                            }
                        }
                    }

                    controller.close();
                } catch (error: any) {
                    const isClosedError = error.code === 'ERR_INVALID_STATE' ||
                        (error.message && error.message.includes('Controller is already closed'));

                    if (!isClosedError) {
                        console.error('[Multi-Agent Stream Error]:', error);
                    }
                    try {
                        controller.enqueue(encoder.encode(JSON.stringify({
                            type: 'error',
                            content: error.message || 'Multi-agent processing failed'
                        }) + '\n'));
                        controller.close();
                    } catch (cleanupError) {
                        // Ignore errors during cleanup (e.g. controller already closed)
                        // console.warn('[Safe Cleanup] Controller was likely already closed.');
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
        console.error('[Multi-Agent API Error]:', error);
        return new Response(JSON.stringify({
            error: 'Failed to process multi-agent request',
            details: error.message
        }), { status: 500 });
    }
}
