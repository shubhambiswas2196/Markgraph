const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
    console.log('🔍 Diagnosing User Preferences...');
    try {
        const preferences = await prisma.userPreference.findMany({
            where: {
                category: 'ai_config'
            }
        });

        console.log(`Found ${preferences.length} AI config preferences:`);
        preferences.forEach(p => {
            console.log(`- User: ${p.userId}, Key: ${p.key}, Value: ${p.value.slice(0, 10)}... (Length: ${p.value.length})`);
        });

        if (preferences.length > 0) {
            console.log('\n⚠️ POTENTIAL CONFLICT: Users have stored API keys in the database.');
            console.log('These will override the OPENAI_API_KEY in .env.local, but might be using the new Cerebras baseURL.');
        } else {
            console.log('\n✅ No database preferences found. Using .env.local values.');
        }

    } catch (e) {
        console.error('❌ Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();
