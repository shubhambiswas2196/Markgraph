const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 2; // From the logs
    const sources = await prisma.dataSource.findMany({
        where: { userId }
    });
    console.log('--- ALL SOURCES FOR USER 2 ---');
    console.log(JSON.stringify(sources, null, 2));

    const googleSources = await prisma.dataSource.findMany({
        where: { userId, sourceType: 'google-ads' }
    });
    console.log('--- GOOGLE-ADS SOURCES FOR USER 2 ---');
    console.log(JSON.stringify(googleSources, null, 2));
}

main().finally(() => prisma.$disconnect());
