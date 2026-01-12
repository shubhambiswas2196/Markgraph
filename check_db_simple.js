const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const sources = await prisma.dataSource.findMany();
        console.log('--- DATA SOURCES ---');
        sources.forEach(s => {
            console.log(`ID: ${s.id}, Name: ${s.accountName}, AccountID: "${s.accountId}", UserID: ${s.userId}, Status: ${s.status}`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}
main();
