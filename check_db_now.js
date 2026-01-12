const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDB() {
    try {
        const sources = await prisma.dataSource.findMany();
        console.log('=== DATA SOURCES ===');
        console.log(JSON.stringify(sources, null, 2));

        const users = await prisma.user.findMany({ select: { id: true, email: true } });
        console.log('\n=== USERS ===');
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDB();
