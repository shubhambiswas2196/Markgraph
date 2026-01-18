import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getUserMetaTokens } from '@/lib/meta-oauth';
import { getMetaAdAccounts } from '@/lib/meta-ads';

export async function GET(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const tokens = await getUserMetaTokens(userId);

        if (!tokens || !tokens.accessToken) {
            return NextResponse.json({ error: 'Meta token not found. Please connect in Settings.' }, { status: 404 });
        }

        const accounts = await getMetaAdAccounts(tokens.accessToken);

        return NextResponse.json({ accounts });
    } catch (error: any) {
        console.error('[Meta Accounts API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
