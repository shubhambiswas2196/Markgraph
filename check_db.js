const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const sources = await prisma.dataSource.findMany({
            where: { status: 'active' }
        });
        console.log('Active Data Sources:', JSON.stringify(sources, null, 2));

        const tokens = await prisma.oAuthToken.findMany();
        console.log('OAuth Tokens:', JSON.stringify(tokens, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
