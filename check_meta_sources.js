const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

try {
    console.log('Checking DataSource table for Meta Ads accounts...');
    const sources = db.prepare('SELECT * FROM DataSource WHERE sourceType = ?').all('meta-ads');
    console.log(`Found ${sources.length} Meta Ads sources:`);
    sources.forEach(s => {
        console.log(`- ${s.accountName} (${s.accountId}) - Status: ${s.status}`);
    });

    console.log('\nAll sources:');
    const allSources = db.prepare('SELECT sourceType, accountName, accountId, status FROM DataSource').all();
    console.log(JSON.stringify(allSources, null, 2));
} catch (error) {
    console.error('Database Error:', error.message);
} finally {
    db.close();
}
