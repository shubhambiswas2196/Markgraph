const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSources() {
    try {
        const sources = await prisma.dataSource.findMany();
        console.log('All Data Sources:', JSON.stringify(sources, null, 2));

        const tokens = await prisma.oAuthToken.findMany();
        console.log('All OAuth Tokens:', JSON.stringify(tokens, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkSources();
