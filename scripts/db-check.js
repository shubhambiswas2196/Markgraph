const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DATABASE DIAGNOSTIC ---');

    const userCount = await prisma.user.count();
    console.log('Total Users:', userCount);

    const sources = await prisma.dataSource.findMany({
        include: {
            _count: {
                select: {
                    campaignMetrics: true,
                    adGroupMetrics: true,
                    keywordMetrics: true
                }
            }
        }
    });

    console.log('\n--- DATA SOURCES ---');
    sources.forEach(s => {
        console.log(`ID: ${s.id} | Account: ${s.accountName} (${s.accountId}) | User: ${s.userId}`);
        console.log(`  Campaign Metrics: ${s._count.campaignMetrics}`);
        console.log(`  Ad Group Metrics: ${s._count.adGroupMetrics}`);
        console.log(`  Keyword Metrics: ${s._count.keywordMetrics}`);
        console.log(`  Sync Status: ${s.syncStatus || 'N/A'}`);
    });

    if (sources.length > 0) {
        const latestMetric = await prisma.campaignMetrics.findFirst({
            orderBy: { date: 'desc' }
        });
        console.log('\nLatest Metric Date:', latestMetric ? latestMetric.date : 'NONE');
    }
}

main()
    .catch(e => console.error('Error:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
