import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Use standard lib path

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    const conversationId = parseInt(params.id);

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Return raw data
        return NextResponse.json({
            id: conversation.id,
            title: conversation.title,
            messages: conversation.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                contentLength: m.content?.length,
                toolCalls: m.toolCalls,
                toolCallId: m.toolCallId
            }))
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
