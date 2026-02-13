import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

const THEME_CATEGORY = 'ui';
const THEME_KEY = 'theme';

const isValidTheme = (value: unknown): value is 'light' | 'amoled' =>
    value === 'light' || value === 'amoled';

export async function GET(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);

        const pref = await prisma.userPreference.findUnique({
            where: {
                userId_category_key: {
                    userId,
                    category: THEME_CATEGORY,
                    key: THEME_KEY
                }
            }
        });

        const theme = isValidTheme(pref?.value) ? pref!.value : 'light';
        return NextResponse.json({ theme });
    } catch (error: any) {
        const message = error?.message || '';
        if (message === 'Not authenticated' || message === 'Invalid token') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('Error fetching theme preference:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const body = await request.json();
        const { theme } = body ?? {};

        if (!isValidTheme(theme)) {
            return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
        }

        await prisma.userPreference.upsert({
            where: {
                userId_category_key: {
                    userId,
                    category: THEME_CATEGORY,
                    key: THEME_KEY
                }
            },
            update: {
                value: theme,
                confidence: 1.0,
                source: 'user_input'
            },
            create: {
                userId,
                category: THEME_CATEGORY,
                key: THEME_KEY,
                value: theme,
                confidence: 1.0,
                source: 'user_input'
            }
        });

        return NextResponse.json({ success: true, theme });
    } catch (error: any) {
        const message = error?.message || '';
        if (message === 'Not authenticated' || message === 'Invalid token') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('Error saving theme preference:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
