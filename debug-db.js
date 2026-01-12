const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking Users...');
    const users = await prisma.user.findMany();
    console.log('Users found:', users.length);
    if (users.length > 0) {
        console.log('Sample User ID:', users[0].id);

        console.log('\nChecking Conversations for User', users[0].id, '...');
        const conversations = await prisma.conversation.findMany({
            where: { userId: users[0].id }
        });
        console.log('Conversations:', JSON.stringify(conversations, null, 2));

        console.log('\nChecking Messages for User', users[0].id, '...');
        const messages = await prisma.chatMessage.findMany({
            where: { userId: users[0].id },
            take: 5
        });
        console.log('Recent Messages:', JSON.stringify(messages, null, 2));
    } else {
        console.log('No users found.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
