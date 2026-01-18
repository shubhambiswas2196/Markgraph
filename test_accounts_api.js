// Quick test script to call the accounts API directly
const fetch = require('node-fetch');

async function testAccountsAPI() {
    try {
        console.log('Testing /api/google/insights/accounts endpoint...');

        // This won't work from Node.js because it needs auth cookies,
        // but we can at least see if the endpoint is reachable
        const response = await fetch('http://localhost:3000/api/google/insights/accounts');
        const data = await response.json();

        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAccountsAPI();
