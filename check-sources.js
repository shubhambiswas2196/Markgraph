
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sources = await prisma.dataSource.findMany({ where: { userId: 2 } });
    console.log(JSON.stringify(sources, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
