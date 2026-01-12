const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

console.log('--- Initializing Adapter ---');
// Mimicking src/lib/prisma.ts exactly
const adapter = new PrismaBetterSqlite3({ url: './prisma/dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('--- Debugging Report Creation ---');

    // 1. Fetch a user to ensure we have a valid ID
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('No users found in DB!');
        return;
    }
    console.log('Found User:', user.id, user.name);

    // 2. Attempt to create a report manually via Prisma
    try {
        console.log('Attempting to create report...');
        const report = await prisma.report.create({
            data: {
                userId: user.id,
                title: 'Debug Report',
                layout: '[]'
            }
        });
        console.log('SUCCESS: Report created via Prisma:', report);
    } catch (e) {
        console.error('FAILURE: Prisma create error:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
