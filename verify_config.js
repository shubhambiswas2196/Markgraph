// Note: verify_config.js needs to be run with a tool that supports TS or after compilation.
// However, I'll try to point to the correct source first.
const { getUserAiConfig } = require('./src/lib/ai-config');

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function verify() {
    try {
        console.log('Verifying AI Configuration...');
        const config = await getUserAiConfig(1); // Test for user 1
        console.log('Result:', JSON.stringify(config, null, 2));

        if (config.baseURL.includes('openrouter.ai')) {
            console.log('SUCCESS: Correctly pointed to OpenRouter.');
        } else {
            console.log('FAILURE: Still pointed to:', config.baseURL);
        }
    } catch (e) {
        console.error('Verification failed:', e);
    }
}

verify();
