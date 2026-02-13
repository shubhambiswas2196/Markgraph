const { OpenAI } = require('openai');

async function testOpenRouter() {
    console.log('🧪 Testing OpenRouter Connectivity...\n');

    const client = new OpenAI({
        apiKey: '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',
        baseURL: 'https://openrouter.ai/api/v1'
    });

    const modelName = 'nvidia/nemotron-3-nano-30b-a3b:free';
    console.log(`Target Model: ${modelName}`);

    try {
        console.log('Sending request...');
        const response = await client.chat.completions.create({
            model: modelName,
            messages: [{ role: 'user', content: 'Say "Hello from OpenRouter!"' }],
            max_tokens: 50
        });

        console.log('✅ SUCCESS!');
        console.log('Response:', response.choices[0].message.content);

        console.log('\nTesting Tool Calling...');
        const tools = [{
            type: "function",
            function: {
                name: "get_weather",
                description: "Get weather",
                parameters: { type: "object", properties: { location: { type: "string" } } }
            }
        }];

        const toolResponse = await client.chat.completions.create({
            model: modelName,
            messages: [{ role: 'user', content: 'What is the weather in London?' }],
            tools: tools,
            max_tokens: 50
        });

        if (toolResponse.choices[0].message.tool_calls) {
            console.log('✅ SUCCESS! Tool calling supported.');
            console.log('Tool Calls:', JSON.stringify(toolResponse.choices[0].message.tool_calls, null, 2));
        } else {
            console.log('⚠️ WARNING: No tool call returned.');
            console.log('Response Content:', toolResponse.choices[0].message.content);
        }

    } catch (err) {
        console.error('❌ ERROR:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
        }
    }
}

testOpenRouter();
