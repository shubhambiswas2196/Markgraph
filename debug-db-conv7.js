
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const conversationId = 7; // As seen in user logs
    console.log(`Checking conversation ${conversationId}...`);

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!conversation) {
        console.log("Conversation not found!");
    } else {
        console.log(`Conversation Title: ${conversation.title}`);
        console.log(`Message Count: ${conversation.messages.length}`);
        conversation.messages.forEach(msg => {
            console.log(`\n[${msg.id}] Role: ${msg.role}`);
            console.log(`Content Length: ${msg.content ? msg.content.length : 'NULL'}`);
            console.log(`Content Preview: ${msg.content ? msg.content.substring(0, 50) : 'N/A'}...`);
            console.log(`ToolCalls: ${msg.toolCalls || 'NULL'}`);
        });
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
