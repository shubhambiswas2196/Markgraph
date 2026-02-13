import prisma from '@/lib/prisma';
import { getGoogleAdsClient, getUserTokens } from './google-ads';

// Generic sync function for any date range
export async function syncMetrics(userId: number, sourceId: number, accountId: string, managerId: string | null | undefined, startDate: Date, endDate: Date) {
    try {
        console.log(`[SyncEngine] Starting sync for ${accountId}, Status: SYNCING`);

        // Update status to SYNCING
        await prisma.dataSource.update({
            where: { id: sourceId },
            data: { syncStatus: 'SYNCING' }
        }).catch((e: Error) => console.warn('Failed to update syncStatus to SYNCING:', e.message));

        const client = await getGoogleAdsClient();
        const tokens = await getUserTokens(userId);
        if (!tokens.accessToken || !tokens.refreshToken) throw new Error('Missing tokens');

        const loginId = managerId || accountId;
        const customer = client.Customer({
            customer_id: accountId.replace(/-/g, ''),
            login_customer_id: loginId.replace(/-/g, ''),
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
        } as any);

        let currentStart = new Date(startDate);

        while (currentStart <= endDate) {
            let currentEnd = new Date(currentStart);
            currentEnd.setDate(currentEnd.getDate() + 30); // 30 day chunks
            if (currentEnd > endDate) currentEnd = endDate;

            const startStr = currentStart.toISOString().split('T')[0];
            const endStr = currentEnd.toISOString().split('T')[0];

            console.log(`[SyncEngine] Syncing ${accountId}: ${startStr} to ${endStr}`);

            // 1. Campaign Metrics
            const campaignQuery = `
                SELECT
                    segments.date,
                    segments.hour,
                    campaign.id,
                    campaign.name,
                    campaign.status,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions,
                    metrics.conversions_value
                FROM campaign
                WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'
            `;

            try {
                const cmpResult = await customer.query(campaignQuery);
                if (cmpResult.length > 0) {
                    const ops = cmpResult.map((row: any) => {
                        const date = new Date(row.segments.date);
                        const hour = parseInt(row.segments.hour || 0);
                        return prisma.campaignMetrics.upsert({
                            where: { dataSourceId_campaignId_date_hour: { dataSourceId: sourceId, campaignId: row.campaign.id.toString(), date, hour } },
                            update: {
                                impressions: parseInt(row.metrics?.impressions || 0),
                                clicks: parseInt(row.metrics?.clicks || 0),
                                cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                                conversions: parseInt(row.metrics?.conversions || 0),
                                conversionValue: parseFloat(row.metrics?.conversions_value || 0),
                                campaignName: row.campaign.name,
                                status: row.campaign.status.toString()
                            },
                            create: {
                                dataSourceId: sourceId,
                                campaignId: row.campaign.id.toString(),
                                campaignName: row.campaign.name,
                                status: row.campaign.status.toString(),
                                date,
                                hour,
                                impressions: parseInt(row.metrics?.impressions || 0),
                                clicks: parseInt(row.metrics?.clicks || 0),
                                cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                                conversions: parseInt(row.metrics?.conversions || 0),
                                conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                            }
                        });
                    });
                    await prisma.$transaction(ops);
                }
            } catch (err: any) {
                console.error(`[SyncEngine] Campaign sync failed batch ${startStr}:`, err.message);
            }

            // 2. AdGroup Metrics
            const adGroupQuery = `
                SELECT
                    segments.date,
                    segments.hour,
                    ad_group.id,
                    ad_group.name,
                    ad_group.campaign,
                    ad_group.status,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions,
                    metrics.conversions_value
                FROM ad_group
                WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'
            `;
            try {
                const agResult = await customer.query(adGroupQuery);
                if (agResult.length > 0) {
                    const agOps = agResult.map((row: any) => {
                        const date = new Date(row.segments.date);
                        const hour = parseInt(row.segments.hour || 0);
                        return prisma.adGroupMetrics.upsert({
                            where: { dataSourceId_adGroupId_date_hour: { dataSourceId: sourceId, adGroupId: row.ad_group.id.toString(), date, hour } },
                            update: {
                                impressions: parseInt(row.metrics?.impressions || 0),
                                clicks: parseInt(row.metrics?.clicks || 0),
                                cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                                conversions: parseInt(row.metrics?.conversions || 0),
                                conversionValue: parseFloat(row.metrics?.conversions_value || 0),
                                adGroupName: row.ad_group.name,
                                campaignId: row.ad_group.campaign.toString(),
                                status: row.ad_group.status.toString()
                            },
                            create: {
                                dataSourceId: sourceId,
                                adGroupId: row.ad_group.id.toString(),
                                adGroupName: row.ad_group.name,
                                campaignId: row.ad_group.campaign.toString(),
                                status: row.ad_group.status.toString(),
                                date,
                                hour,
                                impressions: parseInt(row.metrics?.impressions || 0),
                                clicks: parseInt(row.metrics?.clicks || 0),
                                cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                                conversions: parseInt(row.metrics?.conversions || 0),
                                conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                            }
                        });
                    });
                    await prisma.$transaction(agOps);
                }
            } catch (err: any) {
                console.error(`[SyncEngine] AdGroup sync failed batch ${startStr}:`, err.message);
            }

            // Move to next chunk
            currentStart.setDate(currentStart.getDate() + 31);
        }

        // 3. Demographics & Advanced Segments (Simpler sync for last 30 days to avoid massive overhead)
        const demoStart = new Date();
        demoStart.setDate(demoStart.getDate() - 30);
        const demoStartStr = demoStart.toISOString().split('T')[0];
        const demoEndStr = new Date().toISOString().split('T')[0];

        // 3.1 Gender Metrics
        const genderQuery = `
            SELECT
                segments.date,
                ad_group_criterion.gender.type,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM gender_view
            WHERE segments.date BETWEEN '${demoStartStr}' AND '${demoEndStr}'
        `;
        try {
            const genderResult = await customer.query(genderQuery);
            if (genderResult.length > 0) {
                const ops = genderResult.map((row: any) => ({
                    where: { dataSourceId_gender_date: { dataSourceId: sourceId, gender: row.ad_group_criterion.gender.type, date: new Date(row.segments.date) } },
                    update: {
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    },
                    create: {
                        dataSourceId: sourceId,
                        gender: row.ad_group_criterion.gender.type,
                        date: new Date(row.segments.date),
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    }
                }));
                for (const op of ops) {
                    await prisma.genderMetrics.upsert(op);
                }
            }
        } catch (err: any) { console.error(`[SyncEngine] Gender sync failed:`, err.message); }

        // 3.2 Age Range Metrics
        const ageQuery = `
            SELECT
                segments.date,
                ad_group_criterion.age_range.type,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM age_range_view
            WHERE segments.date BETWEEN '${demoStartStr}' AND '${demoEndStr}'
        `;
        try {
            const ageResult = await customer.query(ageQuery);
            if (ageResult.length > 0) {
                const ops = ageResult.map((row: any) => ({
                    where: { dataSourceId_ageRange_date: { dataSourceId: sourceId, ageRange: row.ad_group_criterion.age_range.type, date: new Date(row.segments.date) } },
                    update: {
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    },
                    create: {
                        dataSourceId: sourceId,
                        ageRange: row.ad_group_criterion.age_range.type,
                        date: new Date(row.segments.date),
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    }
                }));
                for (const op of ops) {
                    await prisma.ageRangeMetrics.upsert(op);
                }
            }
        } catch (err: any) { console.error(`[SyncEngine] Age sync failed:`, err.message); }

        // 3.3 Income Range Metrics
        const incomeQuery = `
            SELECT
                segments.date,
                ad_group_criterion.income_range.type,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM income_range_view
            WHERE segments.date BETWEEN '${demoStartStr}' AND '${demoEndStr}'
        `;
        try {
            const incomeResult = await customer.query(incomeQuery);
            if (incomeResult.length > 0) {
                const ops = incomeResult.map((row: any) => ({
                    where: { dataSourceId_incomeRange_date: { dataSourceId: sourceId, incomeRange: row.ad_group_criterion.income_range.type, date: new Date(row.segments.date) } },
                    update: {
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    },
                    create: {
                        dataSourceId: sourceId,
                        incomeRange: row.ad_group_criterion.income_range.type,
                        date: new Date(row.segments.date),
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    }
                }));
                for (const op of ops) {
                    await prisma.incomeRangeMetrics.upsert(op);
                }
            }
        } catch (err: any) { console.error(`[SyncEngine] Income sync failed:`, err.message); }

        // 3.4 Device Metrics
        const deviceQuery = `
            SELECT
                segments.date,
                segments.device,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE segments.date BETWEEN '${demoStartStr}' AND '${demoEndStr}'
        `;
        try {
            const deviceResult = await customer.query(deviceQuery);
            if (deviceResult.length > 0) {
                const ops = deviceResult.map((row: any) => ({
                    where: { dataSourceId_device_date: { dataSourceId: sourceId, device: row.segments.device, date: new Date(row.segments.date) } },
                    update: {
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    },
                    create: {
                        dataSourceId: sourceId,
                        device: row.segments.device,
                        date: new Date(row.segments.date),
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    }
                }));
                for (const op of ops) {
                    await prisma.deviceMetrics.upsert(op);
                }
            }
        } catch (err: any) { console.error(`[SyncEngine] Device sync failed:`, err.message); }

        // 3.5 Location Metrics (State, City, Postal Code) - Using geographic_view for actual reach
        const locationQuery = `
            SELECT
                segments.date,
                geographic_view.country_criterion_id,
                segments.geo_target_state,
                segments.geo_target_city,
                segments.geo_target_postal_code,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM geographic_view
            WHERE segments.date BETWEEN '${demoStartStr}' AND '${demoEndStr}'
        `;
        try {
            const locResult = await customer.query(locationQuery);
            if (locResult.length > 0) {
                const ops = locResult.map((row: any) => ({
                    where: {
                        dataSourceId_country_region_city_postalCode_date: {
                            dataSourceId: sourceId,
                            country: 'US', // Defaulting for now or extract from resource name
                            region: row.segments?.geo_target_state || 'Unknown',
                            city: row.segments?.geo_target_city || 'Unknown',
                            postalCode: row.segments?.geo_target_postal_code || 'Unknown',
                            date: new Date(row.segments.date)
                        }
                    },
                    update: {
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    },
                    create: {
                        dataSourceId: sourceId,
                        country: 'US',
                        region: row.segments?.geo_target_state || 'Unknown',
                        city: row.segments?.geo_target_city || 'Unknown',
                        postalCode: row.segments?.geo_target_postal_code || 'Unknown',
                        date: new Date(row.segments.date),
                        impressions: parseInt(row.metrics?.impressions || 0),
                        clicks: parseInt(row.metrics?.clicks || 0),
                        cost: parseFloat(row.metrics?.cost_micros || 0) / 1000000,
                        conversions: parseInt(row.metrics?.conversions || 0),
                        conversionValue: parseFloat(row.metrics?.conversions_value || 0)
                    }
                }));
                for (const op of ops) {
                    await prisma.locationMetrics.upsert(op);
                }
            }
        } catch (err: any) { console.error(`[SyncEngine] Location sync failed:`, err.message); }

        // Sync Success
        await prisma.dataSource.update({
            where: { id: sourceId },
            data: { syncStatus: 'ACTIVE', lastSyncedAt: new Date() }
        }).catch((e: Error) => console.warn('Failed to update syncStatus to ACTIVE:', e.message));

        console.log(`[SyncEngine] Sync COMPLETED for ${accountId}`);
        return true;
    } catch (err) {
        console.error(`[SyncEngine] Error syncing ${accountId}:`, err);
        // Sync Failed
        await prisma.dataSource.update({
            where: { id: sourceId },
            data: { syncStatus: 'FAILED' }
        }).catch((e: Error) => console.error('Failed to update error status:', e));
        return false;
    }
}



export async function syncTodaysData(userId: number, sourceId: number, accountId: string, managerId?: string | null) {
    console.log(`[SyncEngine] Syncing TODAY for ${accountId}`);
    const today = new Date();
    return syncMetrics(userId, sourceId, accountId, managerId, today, today);
}
