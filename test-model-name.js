const { OpenAI } = require('openai');

async function testModelName() {
    const client = new OpenAI({
        apiKey: 'csk-89p9xe4h9d6xrj396m5djf3x9368mmthrn2f6658chpx8xm2',
        baseURL: 'https://api.cerebras.ai/v1'
    });

    console.log('Testing Cerebras model: qwen-3-32b\n');

    try {
        const response = await client.chat.completions.create({
            model: 'qwen-3-32b',
            messages: [{ role: 'user', content: 'Say "Hello from qwen-3-32b!" in 5 words or less.' }],
            max_tokens: 50
        });

        console.log('✅ SUCCESS!');
        console.log('Full Response:', JSON.stringify(response, null, 2));
        console.log('Response Content:', response.choices[0].message.content);
        console.log('\nModel is working correctly with qwen-3-32b');
    } catch (err) {
        console.error('❌ ERROR:', err.message);
        console.error('\nTrying alternative model: llama3.1-70b...\n');

        try {
            const response2 = await client.chat.completions.create({
                model: 'llama3.1-70b',
                messages: [{ role: 'user', content: 'Say "Hello from Cerebras!" in 5 words or less.' }],
                max_tokens: 50
            });

            console.log('✅ SUCCESS with llama3.1-70b!');
            console.log('Response:', response2.choices[0].message.content);
            console.log('\nYou should use model: llama3.1-70b instead');
        } catch (err2) {
            console.error('❌ Both models failed. Please check your API key and Cerebras documentation.');
        }
    }
}

testModelName();
