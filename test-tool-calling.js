const { OpenAI } = require('openai');

async function testToolConnection() {
    const client = new OpenAI({
        apiKey: 'csk-89p9xe4h9d6xrj396m5djf3x9368mmthrn2f6658chpx8xm2',
        baseURL: 'https://api.cerebras.ai/v1'
    });

    console.log('Testing Tool Calling with qwen-3-32b...\n');

    const tools = [{
        type: "function",
        function: {
            name: "get_weather",
            description: "Get the current weather in a given location",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "The city and state, e.g. San Francisco, CA"
                    },
                    unit: { type: "string", enum: ["celsius", "fahrenheit"] }
                },
                required: ["location"]
            }
        }
    }];

    try {
        const response = await client.chat.completions.create({
            model: 'qwen-3-32b',
            messages: [
                { role: 'user', content: 'What is the weather in London?' }
            ],
            tools: tools,
            tool_choice: "auto",
            max_tokens: 500
        });

        const toolCalls = response.choices[0].message.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
            console.log('✅ SUCCESS! Model attempted to call tool.');
            console.log('Tool Calls:', JSON.stringify(toolCalls, null, 2));
        } else {
            console.log('⚠️ WARNING: Model responded without calling tools.');
            console.log('Content:', response.choices[0].message.content);
            console.log('Full Message:', JSON.stringify(response.choices[0].message, null, 2));
        }

    } catch (err) {
        console.error('❌ ERROR:', err.message);
        console.error('Error Details:', err);
    }
}

testToolConnection();
