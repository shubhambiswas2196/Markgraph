const https = require('https');

const ACCESS_TOKEN = 'EAAQ0xigKWxMBQUT4axELXpzIQ16oFTl7HOvl6MpWDIa92tt4LTjJ45wByYThycmMG4wZAaZB6bJghuXueIuedhqurKpHeDlpbNMFEFw5ZBxAqZABnUjv5rHDJpHtaiKduNcHKzRhAlwihTmMiKUZA9ZBWqTfn6wRzGCEhm7x2LvBSimQ1eb9dTTy7oXMupAZBXaeM7aVVC01ggbZAERqGDTvFS60a0c8RtfUvsBSgLHhd9beGGWtMG2o0u3d0yVEZCTFuz8OXRu5rs3t4ZCv1sNsFYaHF0'; // User provided token
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

async function testToken() {
    console.log('--- Testing Meta Access Token ---');
    console.log(`Token Prefix: ${ACCESS_TOKEN.substring(0, 15)}...`);

    try {
        // 1. Get User Info ("Me")
        console.log('\n[1] Fetching User Info (/me)...');
        const me = await fetchMeta(`me?fields=id,name&access_token=${ACCESS_TOKEN}`);

        if (me.data.error) {
            console.error('❌ Error fetching user:', me.data.error.message);
            console.error('   Type:', me.data.error.type);
            return;
        }

        console.log('✅ User Found:');
        console.log(`   Name: ${me.data.name}`);
        console.log(`   ID:   ${me.data.id}`);

        // 2. Get Permissions
        console.log('\n[2] Checking Permissions (/me/permissions)...');
        const perms = await fetchMeta(`me/permissions?access_token=${ACCESS_TOKEN}`);
        if (perms.data.data) {
            const granted = perms.data.data
                .filter(p => p.status === 'granted')
                .map(p => p.permission);
            console.log('✅ Granted Permissions:', granted.join(', '));

            const needed = ['ads_read', 'ads_management'];
            const missing = needed.filter(n => !granted.includes(n));
            if (missing.length > 0) {
                console.warn('⚠️  MISSING CRITICAL PERMISSIONS:', missing.join(', '));
            } else {
                console.log('✅ All critical permissions (ads_read, ads_management) present.');
            }
        }

        // 3. Get Ad Accounts
        console.log('\n[3] Fetching Ad Accounts (/me/adaccounts)...');
        const accounts = await fetchMeta(`me/adaccounts?fields=id,name,account_id,currency,account_status&access_token=${ACCESS_TOKEN}`);

        if (accounts.data.data && accounts.data.data.length > 0) {
            console.log(`✅ Found ${accounts.data.data.length} Ad Account(s):`);
            accounts.data.data.forEach(acc => {
                console.log(`   - [${acc.account_id}] ${acc.name} (${acc.currency}) Status: ${acc.account_status}`);
            });
        } else {
            console.warn('⚠️  No Ad Accounts found for this user.');
            console.warn('   (The user might not have created any ad accounts yet, or needs to be added to one)');
        }

    } catch (error) {
        console.error('❌ Script execution error:', error.message);
    }
    console.log('\n--- End of Test ---');
}

testToken();
