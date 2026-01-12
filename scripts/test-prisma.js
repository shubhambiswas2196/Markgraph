const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Testing Prisma Client Query (Simplified)...');
    try {
        const sources = await prisma.dataSource.findMany({
            where: {
                userId: 2,
                sourceType: 'google-ads',
                status: 'active'
            },
            select: {
                accountId: true,
                accountName: true,
                currency: true  // No new fields
            }
        });
        console.log('Query successful:', sources);
    } catch (e) {
        console.error('Prisma Query Failed:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
