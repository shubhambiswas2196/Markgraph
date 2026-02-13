import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper to get userId from JWT token
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

// GET: Fetch all conversations for the logged-in user
export async function GET(request: NextRequest) {
    const userId = getUserIdFromToken(request);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: {
                    select: { messages: true }
                }
            },
            take: 50 // Limit to 50 most recent conversations
        });

        const formattedConversations = conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: conv._count.messages
        }));

        return NextResponse.json({ conversations: formattedConversations });
    } catch (error: any) {
        console.error('Error fetching conversations:', error);
        return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }
}

// POST: Create a new conversation
export async function POST(request: NextRequest) {
    const userId = getUserIdFromToken(request);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { title } = body;

        // Auto-generate title if not provided
        const conversationTitle = title || `New Conversation - ${new Date().toLocaleString()}`;

        const conversation = await prisma.conversation.create({
            data: {
                userId,
                title: conversationTitle
            }
        });

        return NextResponse.json({
            conversation: {
                id: conversation.id,
                title: conversation.title,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                messageCount: 0
            }
        });
    } catch (error: any) {
        console.error('Error creating conversation:', error);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }
}
