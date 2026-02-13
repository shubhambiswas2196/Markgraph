import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const secret = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
        const decoded = jwt.verify(token, secret) as { userId: number; email: string };

        // Fetch full user details from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check for AI configuration
        const aiConfig = await prisma.userPreference.findUnique({
            where: {
                userId_category_key: {
                    userId: user.id,
                    category: 'ai_config',
                    key: 'openrouter_api_key'
                }
            }
        });

        return NextResponse.json({
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            hasAiConfig: !!aiConfig || !!process.env.OPENAI_API_KEY
        });
    } catch (error: any) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}
