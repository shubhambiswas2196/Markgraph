
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const locCount = await prisma.locationMetrics.count();
    const locSample = await prisma.locationMetrics.findMany({ take: 5 });
    console.log('LocationMetrics Count:', locCount);
    console.log('Sample Data:', JSON.stringify(locSample, null, 2));

    const campaigns = await prisma.campaignMetrics.findMany({ take: 5 });
    console.log('CampaignMetrics Sample (Conversions):', JSON.stringify(campaigns.map(c => ({ id: c.id, name: c.campaignName, conv: c.conversions })), null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
