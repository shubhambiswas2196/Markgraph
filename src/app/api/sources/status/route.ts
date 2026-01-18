import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    try {
        // Extract userId from JWT token instead of query parameter
        const userId = await getUserIdFromRequest(request);

        // Check for Google OAuth token
        const token = await (prisma as any).oAuthToken.findFirst({
            where: {
                userId: userId,
                provider: 'google',
            },
        });

        // Get connected data sources
        const sources = await (prisma as any).dataSource.findMany({
            where: {
                userId: userId,
                status: 'active'
            },
            select: {
                accountId: true,
                accountName: true,
                currency: true,
                managerId: true,
                googleEmail: true,
                sourceType: true,
                clientName: true,
                status: true
            }
        });

        console.log(`DEBUG [sources/status]: userId=${userId}, found ${sources?.length || 0} sources`);

        return NextResponse.json({
            isConnected: !!token || (sources && sources.length > 0),
            sources: sources || []
        });
    } catch (error: any) {
        console.error('Status check error:', error);

        // Return 401 for authentication errors
        if (error.message === 'Not authenticated' || error.message === 'Invalid token') {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        try {
            fs.writeFileSync(path.join(process.cwd(), 'server-debug.log'), `[${new Date().toISOString()}] Error in sources/status: ${error.message}\nStack: ${error.stack}\n`, { flag: 'a' });
        } catch (e) { console.error('Failed to write log', e); }
        return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
    }
}
