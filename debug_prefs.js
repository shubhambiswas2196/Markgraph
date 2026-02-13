const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking User AI Preferences...');
        const prefs = await prisma.userPreference.findMany({
            where: {
                category: 'ai_config'
            }
        });

        if (prefs.length === 0) {
            console.log('No user-specific AI configurations found in database.');
        } else {
            console.log(`Found ${prefs.length} AI configurations:`);
            prefs.forEach(p => {
                console.log(`UserID: ${p.userId}, Key: ${p.key}, Value: ${p.value.substring(0, 10)}...`);
            });
        }
    } catch (error) {
        console.error('Prisma Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
