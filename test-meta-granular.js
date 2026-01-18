const https = require('https');

const ACCESS_TOKEN = 'EAAQ0xigKWxMBQUT4axELXpzIQ16oFTl7HOvl6MpWDIa92tt4LTjJ45wByYThycmMG4wZAaZB6bJghuXueIuedhqurKpHeDlpbNMFEFw5ZBxAqZABnUjv5rHDJpHtaiKduNcHKzRhAlwihTmMiKUZA9ZBWqTfn6wRzGCEhm7x2LvBSimQ1eb9dTTy7oXMupAZBXaeM7aVVC01ggbZAERqGDTvFS60a0c8RtfUvsBSgLHhd9beGGWtMG2o0u3d0yVEZCTFuz8OXRu5rs3t4ZCv1sNsFYaHF0';
const ACCOUNT_ID = 'act_1167172446823760'; // Victoria Courts 2020 (USD)
const API_VERSION = 'v22.0';

function fetchMeta(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `https://graph.facebook.com/${API_VERSION}/${endpoint}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function testGranular() {
    console.log(`--- Testing Granular Data for ${ACCOUNT_ID} ---`);

    try {
        // 1. Fetch Campaigns (Active/Paused)
        console.log('\n[1] Fetching Campaigns (last 5)...');
        const camps = await fetchMeta(`${ACCOUNT_ID}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=5&access_token=${ACCESS_TOKEN}`);

        if (camps.data.data && camps.data.data.length > 0) {
            console.log(`✅ Found ${camps.data.data.length} Campaign(s):`);
            camps.data.data.forEach(c => {
                const budget = c.daily_budget ? `Daily: ${(c.daily_budget / 100).toFixed(2)}` : (c.lifetime_budget ? `Lifetime: ${(c.lifetime_budget / 100).toFixed(2)}` : 'No Budget');
                console.log(`   - [${c.id}] "${c.name}" (${c.status}) - ${c.objective} - ${budget}`);
            });
        } else {
            console.warn('⚠️  No Campaigns found (or error).', camps.data.error ? camps.data.error.message : '');
        }

        // 2. Fetch Ad Sets for first campaign if exists
        if (camps.data.data && camps.data.data.length > 0) {
            const firstCampId = camps.data.data[0].id;
            console.log(`\n[2] Fetching Ad Sets for Campaign ${firstCampId}...`);
            const adsets = await fetchMeta(`${firstCampId}/adsets?fields=id,name,status,targeting&limit=3&access_token=${ACCESS_TOKEN}`);
            if (adsets.data.data) {
                adsets.data.data.forEach(a => {
                    console.log(`   - [${a.id}] "${a.name}" (${a.status})`);
                    // console.log(`     Targeting:`, JSON.stringify(a.targeting).substring(0, 100) + '...');
                });
            }
        }

        // 3. Granular Insights: Age & Gender Breakdown (Last 30 Days)
        console.log('\n[3] Fetching Insights (Age/Gender Breakdown, Last 30 Days)...');
        const insightsUrl = `${ACCOUNT_ID}/insights?date_preset=last_30d&level=account&breakdowns=age,gender&fields=impressions,clicks,spend,actions&limit=10&access_token=${ACCESS_TOKEN}`;
        const insights = await fetchMeta(insightsUrl);

        if (insights.data.data && insights.data.data.length > 0) {
            console.log('✅ Found Demographic Data (Top rows):');
            insights.data.data.slice(0, 5).forEach(row => {
                console.log(`   - [${row.age} | ${row.gender}]: ${row.impressions} Impr, ${row.clicks} Clicks, Spend: ${row.spend}`);
            });
        } else {
            console.warn('⚠️  No Insight data found (Account might be inactive recently).', insights.data.error ? insights.data.error.message : '');
        }

        // 4. Granular Insights: Hourly/Daily (Time breakdown) is also possible but heavy output. 
        // We confirmed "granular" capability with Age/Gender.

    } catch (error) {
        console.error('❌ Script error:', error.message);
    }
    console.log('\n--- End of Granular Test ---');
}

testGranular();
