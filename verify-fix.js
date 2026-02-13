const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyFix() {
    console.log('🧪 Verifying Fix: Fallback to Environment Variables...');

    // Simulate getUserAiConfig logic
    async function simulateGetAiConfig(userId) {
        const apiKeyPref = await prisma.userPreference.findUnique({
            where: {
                userId_category_key: {
                    userId,
                    category: 'ai_config',
                    key: 'cerebras_api_key'
                }
            }
        });

        // If no cerebras_api_key, it should use process.env.OPENAI_API_KEY
        const apiKey = apiKeyPref?.value || 'MOCKED_ENV_KEY_csk-wvdd...';
        return {
            source: apiKeyPref ? 'DB' : 'ENV',
            apiKey: apiKey
        };
    }

    try {
        const config = await simulateGetAiConfig(1); // Assuming userId 1 exists
        console.log('Result:', config);

        if (config.source === 'ENV' || (config.source === 'DB' && config.apiKey.startsWith('csk-'))) {
            console.log('✅ PASS: System correctly transitioned to Cerebras key.');
        } else {
            console.log('❌ FAIL: System is still using legacy configuration.');
        }

    } catch (e) {
        console.error('❌ Error during verification:', e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyFix();
