import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Extract userId from JWT token instead of query parameter
        const userId = await getUserIdFromRequest(request);

        const token = await (prisma as any).oAuthToken.findFirst({
            where: {
                userId: userId,
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

        // Return 401 for authentication errors
        if (error instanceof Error && (error.message === 'Not authenticated' || error.message === 'Invalid token')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return NextResponse.json({ error: 'Failed to check authorization' }, { status: 500 });
    }
}
