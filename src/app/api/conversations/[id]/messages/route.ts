import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function getUserIdFromToken(request: NextRequest): number | null {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        return decoded.userId;
    } catch {
        return null;
    }
}

// POST: Save a new message to a conversation
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const userId = getUserIdFromToken(request);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const conversationId = parseInt(params.id);

    try {
        const body = await request.json();
        const { role, content, toolCalls, toolCallId } = body;

        // Validate required fields (Content OR ToolCalls must be present)
        if (!role || (!content && !toolCalls && !toolCallId)) {
            return NextResponse.json({ error: 'Role and either content or toolCalls are required' }, { status: 400 });
        }

        // Verify conversation belongs to user
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId }
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Create message
        const message = await prisma.chatMessage.create({
            data: {
                userId,
                conversationId,
                role,
                content,
                toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
                toolCallId: toolCallId || null
            }
        });

        // Update conversation's updatedAt timestamp
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        return NextResponse.json({ message });
    } catch (error: any) {
        console.error('Error saving message:', error);
        return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }
}
