import prisma from '../src/lib/prisma';

async function main() {
    console.log('--- USERS ---');
    const users = await (prisma as any).user.findMany(); // Cast to any to avoid type check issues in script
    console.log(JSON.stringify(users, null, 2));

    console.log('\n--- DATA SOURCES ---');
    const sources = await (prisma as any).dataSource.findMany();
    console.log(JSON.stringify(sources, null, 2));

    console.log('\n--- OAUTH TOKENS ---');
    const tokens = await (prisma as any).oAuthToken.findMany();
    console.log(JSON.stringify(tokens, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
