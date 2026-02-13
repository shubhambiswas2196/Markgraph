const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

try {
    const row = db.prepare("SELECT accessToken FROM oAuthToken WHERE userId = 2 AND provider = 'meta' ORDER BY updatedAt DESC").get();
    if (row) {
        const t = row.accessToken;
        console.log('Token Length:', t.length);
        console.log('Token Prefix:', t.substring(0, 10));
        console.log('Token Suffix:', t.substring(t.length - 10));

        let hasWeirdChars = false;
        for (let i = 0; i < t.length; i++) {
            const code = t.charCodeAt(i);
            if (code < 33 || code > 126) {
                console.log(`Hidden char found at index ${i}: code ${code}`);
                hasWeirdChars = true;
            }
        }
        if (!hasWeirdChars) {
            console.log('No hidden characters found.');
        }

        // Test with fetch
        console.log('Testing token with Facebook API (Ad Accounts)...');
        fetch(`https://graph.facebook.com/v22.0/me/adaccounts?fields=id,name,account_id&access_token=${t}`)
            .then(r => r.json())
            .then(j => {
                console.log('Ad Accounts Response:', JSON.stringify(j, null, 2));
                if (j.data) {
                    const match = j.data.find(a => a.id === 'act_1167172446823760' || a.account_id === '1167172446823760');
                    console.log('Found target account act_1167172446823760?', !!match);
                }
            })
            .catch(e => console.error('Fetch error:', e));
    } else {
        console.log('No token found for userId 2');
    }
} catch (e) {
    console.error('Error:', e);
} finally {
    db.close();
}
