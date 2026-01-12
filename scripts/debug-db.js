const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- USERS ---');
    const users = await prisma.user.findMany();
    console.log(JSON.stringify(users, null, 2));

    console.log('\n--- DATA SOURCES ---');
    const sources = await prisma.dataSource.findMany();
    console.log(JSON.stringify(sources, null, 2));

    console.log('\n--- OAUTH TOKENS ---');
    const tokens = await prisma.oAuthToken.findMany();
    console.log(JSON.stringify(tokens, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
