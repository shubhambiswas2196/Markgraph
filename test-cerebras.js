const { OpenAI } = require('openai');

async function testCerebrasTools() {
    const client = new OpenAI({
        apiKey: 'csk-phdxkjw3k5964njvxcfw46npx9n6yhp9vn4fdyd34tpf4cvt',
        baseURL: 'https://api.cerebras.ai/v1'
    });

    const tools = [{
        type: "function",
        function: {
            name: "get_weather",
            description: "Get the weather",
            parameters: { type: "object", properties: { location: { type: "string" } } }
        }
    }];

    console.log("Testing Cerebras tool calling with model: llama3.1-8b...");
    try {
        const response = await client.chat.completions.create({
            model: 'llama3.1-8b',
            messages: [{ role: 'user', content: 'What is the weather in London?' }],
            tools: tools,
            tool_choice: "auto"
        });
        console.log("Response:", JSON.stringify(response.choices[0].message, null, 2));
    } catch (err) {
        console.error("Cerebras Tool Test Error:", err.message);
    }
}

testCerebrasTools();
