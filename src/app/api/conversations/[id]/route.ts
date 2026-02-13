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

// GET: Fetch all messages for a specific conversation
export async function GET(
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
        // Verify conversation belongs to user
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        return NextResponse.json({
            conversation: {
                id: conversation.id,
                title: conversation.title,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                messages: conversation.messages
            }
        });
    } catch (error: any) {
        console.error('Error fetching conversation:', error);
        return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
    }
}

// DELETE: Delete a conversation and all its messages
export async function DELETE(
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
        // Verify conversation belongs to user before deleting
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId }
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Delete conversation (messages will cascade delete)
        await prisma.conversation.delete({
            where: { id: conversationId }
        });

        return NextResponse.json({ success: true, message: 'Conversation deleted' });
    } catch (error: any) {
        console.error('Error deleting conversation:', error);
        return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }
}

// PATCH: Update conversation title
export async function PATCH(
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
        const { title } = body;

        if (!title || title.trim().length === 0) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        // Verify conversation belongs to user
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId }
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Update title
        const updatedConversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: { title: title.trim() }
        });

        return NextResponse.json({
            conversation: {
                id: updatedConversation.id,
                title: updatedConversation.title,
                updatedAt: updatedConversation.updatedAt
            }
        });
    } catch (error: any) {
        console.error('Error updating conversation:', error);
        return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
    }
}
