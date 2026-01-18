const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanHistory() {
    console.log('Cleaning invalid tool messages...');
    try {
        const userId = 2; // Assuming active user
        // Find the active conversation
        const conversation = await prisma.conversation.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' }
        });

        if (!conversation) {
            console.log('No conversation found.');
            return;
        }

        console.log(`Checking conversation ${conversation.id}...`);

        const messages = await prisma.chatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'asc' }
        });

        let deletedCount = 0;
        let lastRole = 'system';

        for (const msg of messages) {
            // Check for User -> Tool invalid sequence
            if (msg.role === 'tool' && lastRole === 'human') {
                console.log(`Found invalid sequence: Tool (ID: ${msg.id}) after Human. Deleting Tool message.`);
                await prisma.chatMessage.delete({ where: { id: msg.id } });
                deletedCount++;
                continue; // Skip updating lastRole
            }
            lastRole = msg.role;
        }

        console.log(`Cleanup complete. Deleted ${deletedCount} invalid messages.`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanHistory();
