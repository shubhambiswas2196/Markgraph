const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
        process.stdout.write(keys.join(',') + '\n');
    } catch (e) {
        process.stderr.write(e.message + '\n');
    } finally {
        await prisma.$disconnect();
    }
}

main();
