const apiKey = 'csk-89p9xe4h9d6xrj396m5djf3x9368mmthrn2f6658chpx8xm2';
const model = 'qwen-3-235b-a22b-instruct-2507';

async function testCerebras() {
    console.log('Testing Cerebras API...');
    try {
        const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: 'Say hello!' }
                ]
            })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testCerebras();
