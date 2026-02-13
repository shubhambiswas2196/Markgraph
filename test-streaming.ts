
import { simpleAgentGraph } from './src/lib/blackswan/simple-agent';
import { HumanMessage } from '@langchain/core/messages';

async function testStreaming() {
    console.log("Starting streaming test...");

    // Mock user ID 2 (from logs)
    const userId = 2;

    const messages = [
        new HumanMessage("Hello, tell me a short joke.")
    ];

    try {
        const stream = simpleAgentGraph.streamEvents(
            { messages },
            {
                version: "v2",
                configurable: {
                    userId,
                    thread_id: "test_thread"
                }
            }
        );

        for await (const event of stream) {
            if (event.event === "on_chat_model_stream") {
                console.log(`[Token] ${JSON.stringify(event.data.chunk?.content)}`);
            } else {
                console.log(`[Event] ${event.event} - ${event.name}`);
            }
        }

    } catch (error) {
        console.error("Error during streaming:", error);
    }
}

testStreaming();
