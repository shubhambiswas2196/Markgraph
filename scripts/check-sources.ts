import prisma from '../src/lib/prisma';

async function main() {
    // Hardcoded check for user 2
    const uid = 2;
    console.log(`Checking sources for User ID: ${uid}`);
    const sources = await (prisma as any).dataSource.findMany({
        where: { userId: uid }
    });
    console.log('Found sources:', JSON.stringify(sources, null, 2));
}

main()
    .catch(console.error);
