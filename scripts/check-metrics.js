const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking CampaignMetrics...');
    const metrics = await prisma.campaignMetrics.count();
    console.log('Total Campaign Metrics Rows:', metrics);

    const sources = await prisma.dataSource.findMany({ select: { id: true, accountId: true } });
    console.log('Data Sources:', sources);

    for (const s of sources) {
        const count = await prisma.campaignMetrics.count({ where: { dataSourceId: s.id } });
        console.log(`Source ${s.accountId}: ${count} metrics rows`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
