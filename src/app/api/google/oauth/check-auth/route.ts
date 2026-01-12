import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const uid = parseInt(userId);

        const token = await (prisma as any).oAuthToken.findFirst({
            where: {
                userId: uid,
                provider: 'google'
            }
        });

        if (token && token.expiresAt > new Date()) {
            return NextResponse.json({
                authorized: true,
                expiresAt: token.expiresAt
            });
        }

        return NextResponse.json({ authorized: false });
    } catch (error) {
        console.error('Check auth error:', error);
        return NextResponse.json({ error: 'Failed to check authorization' }, { status: 500 });
    }
}
