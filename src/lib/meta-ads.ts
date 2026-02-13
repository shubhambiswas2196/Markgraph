// Meta Marketing API Integration
// Provides granular access to Meta Ads data

const META_API_VERSION = 'v22.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaAdAccount {
    id: string;
    name: string;
    account_id: string;
    currency: string;
    account_status: number;
}

interface MetaInsightsParams {
    accountId: string;
    level: 'account' | 'campaign' | 'adset' | 'ad';
    datePreset?: string;
    timeRange?: { since: string; until: string };
    fields: string[];
    breakdowns?: string[];
}

/**
 * Fetch Meta Ad Accounts
 */
export async function getMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    try {
        const url = `${META_BASE_URL}/me/adaccounts?fields=id,name,account_id,currency,account_status&access_token=${accessToken}`;
        console.log(`[Meta Ads] Fetching ad accounts: ${url.replace(accessToken, 'REDACTED')}`);

        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            console.error('[Meta Ads] API ERROR (accounts):', JSON.stringify(error, null, 2));
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error: any) {
        console.error('[Meta Ads] Exception in getMetaAdAccounts:', error.message);
        throw error;
    }
}

/**
 * Fetch Meta Insights (Granular Performance Data)
 */
export async function getMetaInsights(
    accessToken: string,
    params: MetaInsightsParams
): Promise<any[]> {
    try {
        const { accountId, level, datePreset, timeRange, fields, breakdowns } = params;

        // Build query parameters
        const queryParams = new URLSearchParams({
            access_token: accessToken,
            level,
            fields: fields.join(','),
        });

        if (datePreset) {
            queryParams.append('date_preset', datePreset);
        } else if (timeRange) {
            queryParams.append('time_range', JSON.stringify(timeRange));
        }

        if (breakdowns && breakdowns.length > 0) {
            queryParams.append('breakdowns', breakdowns.join(','));
        }

        const url = `${META_BASE_URL}/${accountId}/insights?${queryParams.toString()}`;
        console.log(`[Meta Ads] Fetching insights: ${url.replace(accessToken, 'REDACTED')}`);

        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            console.error('[Meta Ads] API ERROR (insights):', JSON.stringify(error, null, 2));
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error: any) {
        console.error('[Meta Ads] Exception in getMetaInsights:', error.message);
        throw error;
    }
}

/**
 * Fetch Campaigns for an Ad Account
 */
export async function getMetaCampaigns(
    accessToken: string,
    accountId: string,
    fields: string[] = ['id', 'name', 'status', 'objective', 'daily_budget', 'lifetime_budget']
): Promise<any[]> {
    try {
        const response = await fetch(
            `${META_BASE_URL}/${accountId}/campaigns?fields=${fields.join(',')}&access_token=${accessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error: any) {
        console.error('[Meta Ads] Error fetching campaigns:', error);
        throw error;
    }
}

/**
 * Fetch Ad Sets for a Campaign
 */
export async function getMetaAdSets(
    accessToken: string,
    campaignId: string,
    fields: string[] = ['id', 'name', 'status', 'daily_budget', 'lifetime_budget', 'targeting']
): Promise<any[]> {
    try {
        const response = await fetch(
            `${META_BASE_URL}/${campaignId}/adsets?fields=${fields.join(',')}&access_token=${accessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error: any) {
        console.error('[Meta Ads] Error fetching ad sets:', error);
        throw error;
    }
}

/**
 * Fetch Ads for an Ad Set
 */
export async function getMetaAds(
    accessToken: string,
    adSetId: string,
    fields: string[] = ['id', 'name', 'status', 'creative']
): Promise<any[]> {
    try {
        const response = await fetch(
            `${META_BASE_URL}/${adSetId}/ads?fields=${fields.join(',')}&access_token=${accessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error: any) {
        console.error('[Meta Ads] Error fetching ads:', error);
        throw error;
    }
}

/**
 * Toggle Entity Status (PAUSED / ACTIVE)
 */
export async function toggleEntityStatus(
    accessToken: string,
    objectId: string,
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
): Promise<any> {
    try {
        const response = await fetch(
            `${META_BASE_URL}/${objectId}?access_token=${accessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error(`[Meta Ads] Error updating status for ${objectId}:`, error);
        throw error;
    }
}

/**
 * Update Budget (Campaign or Ad Set)
 */
export async function updateEntityBudget(
    accessToken: string,
    objectId: string,
    budgetType: 'daily_budget' | 'lifetime_budget',
    amountVal: number
): Promise<any> {
    try {
        // Meta requires amounts in cents (e.g., $10.00 -> 1000)
        // Ensure we send an integer
        const amountCents = Math.round(amountVal * 100);

        const body: any = {};
        body[budgetType] = amountCents;

        const response = await fetch(
            `${META_BASE_URL}/${objectId}?access_token=${accessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error(`[Meta Ads] Error updating budget for ${objectId}:`, error);
        throw error;
    }
}

/**
 * Create a Basic Campaign
 */
export async function createMetaCampaign(
    accessToken: string,
    accountId: string,
    params: { name: string; objective: string; status: string; special_ad_categories: string[] }
): Promise<any> {
    try {
        const response = await fetch(
            `${META_BASE_URL}/${accountId}/campaigns?access_token=${accessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('[Meta Ads] Error creating campaign:', error);
        throw error;
    }
}

/**
 * Get Ad Preview
 */
export async function getAdPreview(
    accessToken: string,
    creativeId: string,
    adFormat: 'DESKTOP_FEED_STANDARD' | 'MOBILE_FEED_STANDARD' = 'DESKTOP_FEED_STANDARD'
): Promise<string> {
    try {
        const response = await fetch(
            `${META_BASE_URL}/${creativeId}/previews?ad_format=${adFormat}&access_token=${accessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data?.[0]?.body || "No preview available"; // Usually returns HTML iframe content
    } catch (error: any) {
        console.error('[Meta Ads] Error fetching ad preview:', error);
        throw error;
    }
}

/**
 * Fetch Ads with Creative Data and Insights for Format Analysis
 */
export async function getMetaAdsWithCreative(
    accessToken: string,
    accountId: string,
    startDate: string,
    endDate: string,
    campaignId?: string
): Promise<any[]> {
    try {
        // Build query for ads with creative (insights fetched separately to reduce payload)
        const fields = [
            'id',
            'name',
            'status',
            'creative{id,object_story_spec,effective_object_story_id}'
        ];

        const queryParams = new URLSearchParams({
            access_token: accessToken,
            fields: fields.join(','),
            limit: '100' // Reduced from 500 to avoid "too much data" error
        });

        // If campaign filter provided, fetch from campaign, otherwise from account
        const endpoint = campaignId
            ? `${META_BASE_URL}/${campaignId}/ads`
            : `${META_BASE_URL}/${accountId}/ads`;

        const url = `${endpoint}?${queryParams.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const ads = data.data || [];

        // Now fetch insights for each ad separately (batched approach)
        const adsWithInsights = await Promise.all(
            ads.slice(0, 50).map(async (ad: any) => { // Limit to 50 ads to avoid timeout
                try {
                    const insightsUrl = `${META_BASE_URL}/${ad.id}/insights?` + new URLSearchParams({
                        access_token: accessToken,
                        time_range: JSON.stringify({ since: startDate, until: endDate }),
                        fields: 'impressions,clicks,spend,reach,actions,action_values'
                    }).toString();

                    const insightsResponse = await fetch(insightsUrl);
                    if (insightsResponse.ok) {
                        const insightsData = await insightsResponse.json();
                        ad.insights = insightsData;
                    }
                } catch (err) {
                    console.warn(`[Meta Ads] Failed to fetch insights for ad ${ad.id}:`, err);
                }
                return ad;
            })
        );

        return adsWithInsights;
    } catch (error: any) {
        console.error('[Meta Ads] Error fetching ads with creative:', error);
        throw error;
    }
}
