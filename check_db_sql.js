const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing raw SQL for clientName column...');
        const result = await prisma.$queryRaw`PRAGMA table_info(DataSource)`;
        console.log('Columns in DataSource:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('SQL Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
