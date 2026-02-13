import { NextRequest } from 'next/server';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const authenticatedUserId = await getUserIdFromRequest(request);
        const body = await request.json();
        const { messages, spreadsheetId, approvalDecision } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Messages array is required' }), { status: 400 });
        }

        // Initialize LangChain messages from history
        const historyMessages = messages.map((m: any) =>
            m.role === 'assistant' ? new AIMessage(m.content) :
                m.role === 'tool' ? new HumanMessage(`[Tool Result]: ${m.content}`) :
                    new HumanMessage(m.content)
        );

        const encoder = new TextEncoder();

        // ENGAGE STANDARD MODE (BLACKSWAN MULTI-AGENT)
        const { multiAgentGraph } = await import('@/lib/blackswan/multi-agent');

        // Inject brevity instruction for Supervisor
        const lastMsg = historyMessages[historyMessages.length - 1];
        if (lastMsg instanceof HumanMessage) {
            lastMsg.content = `${lastMsg.content}\n\n(System Note: Route this request efficiently.)`;
        }

        let eventStream = multiAgentGraph.streamEvents(
            { messages: historyMessages },
            {
                version: "v2",
                recursionLimit: 5000,
                configurable: {
                    userId: authenticatedUserId,
                    thread_id: `romeo_multi_${authenticatedUserId}`
                }
            } as any
        );

        return new Response(new ReadableStream({
            async start(controller) {
                const heartbeat = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }) + '\n'));
                    } catch (e) {
                        clearInterval(heartbeat);
                    }
                }, 15000);

                try {
                    for await (const event of eventStream) {
                        // Granular Node Start Tracking
                        if (event.event === "on_chain_start" && ["nexus", "google_ads_worker", "meta_ads_worker", "google_sheets_worker", "agent"].includes(event.name)) {
                            const nodeNameMap: Record<string, string> = {
                                'nexus': 'Supervisor Routing',
                                'google_ads_worker': 'Google Ads Specialist',
                                'meta_ads_worker': 'Meta Ads Specialist',
                                'google_sheets_worker': 'Google Sheets Specialist',
                                'agent': 'Generating Answer'
                            };
                            controller.enqueue(encoder.encode(JSON.stringify({
                                type: 'node_start',
                                node: event.name,
                                status: nodeNameMap[event.name]
                            }) + '\n'));
                        }
                        // Granular Node END Tracking
                        else if (event.event === "on_chain_end" && ["nexus", "google_ads_worker", "meta_ads_worker", "google_sheets_worker", "agent"].includes(event.name)) {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                type: 'node_end',
                                node: event.name
                            }) + '\n'));
                        }
                        // Relaxed filter for tokens to ensure compatibility with various providers
                        else if (event.event === "on_chat_model_stream" && event.data.chunk?.content) {
                            const token = event.data.chunk.content;
                            if (token) {
                                controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', content: token }) + '\n'));
                            }
                        } else if (event.event === "on_tool_start") {
                            console.log(`[Tool] Starting: ${event.name}`);
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'tool_start', tool: event.name, input: event.data.input }) + '\n'));
                        } else if (event.event === "on_tool_end") {
                            console.log(`[Tool] Ended: ${event.name}`);
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'tool_end', tool: event.name, output: event.data.output }) + '\n'));
                        }
                    }
                    clearInterval(heartbeat);
                    controller.close();
                } catch (e: any) {
                    clearInterval(heartbeat);
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', content: e.message }) + '\n'));
                    controller.close();
                }
            }
        }), { headers: { 'Content-Type': 'application/x-ndjson' } });

    } catch (error: any) {
        console.error('RomeoCharge Chat Error:', error);
        if (error.status === 429) {
            return new Response(JSON.stringify({ error: 'Model overloaded (429). Please try again or switch models.' }), { status: 429 });
        }
        if (error.message === 'Not authenticated' || error.message === 'Invalid token') {
            return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
        }
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
