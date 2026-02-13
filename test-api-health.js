
// Use built-in fetch if available (Node 18+)
const fetch = global.fetch || (() => { throw new Error('Global fetch not available. Please use Node.js 18+ or install node-fetch.'); });


async function testApi() {
    const baseUrl = 'http://localhost:3000';

    // 1. Test /api/conversations (GET)
    console.log('Testing GET /api/conversations...');
    try {
        const res = await fetch(`${baseUrl}/api/conversations`);
        const type = res.headers.get('content-type');
        console.log(`Status: ${res.status}`);
        console.log(`Content-Type: ${type}`);

        if (type && type.includes('application/json')) {
            const data = await res.json();
            console.log('Success! Data:', JSON.stringify(data).substring(0, 100) + '...');
        } else {
            console.error('Error: Received non-JSON response');
            const text = await res.text();
            console.error('Response preview:', text.substring(0, 200));
        }
    } catch (e) {
        console.error('Failed to fetch:', e.message);
    }
}

testApi();
