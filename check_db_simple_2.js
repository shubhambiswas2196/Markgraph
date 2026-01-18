const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing Prisma DataSource query...');
        const sources = await prisma.dataSource.findMany({
            select: { id: true, clientName: true }
        });
        console.log(`Success! Found ${sources.length} sources.`);
        console.log('Sample data:', sources.slice(0, 1));
    } catch (error) {
        console.error('Prisma Error:', error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();
