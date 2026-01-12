const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst();
    if (user) {
        console.log(`FOUND_USER_ID: ${user.id}`);
    } else {
        console.log('NO_USERS_FOUND');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
