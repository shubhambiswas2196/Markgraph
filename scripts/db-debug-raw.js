const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const db = new Database(dbPath, { verbose: null });

console.log('--- RAW DB CHECK ---');

try {
    const metricsCount = db.prepare('SELECT COUNT(*) as count FROM CampaignMetrics').get();
    console.log(`Total Campaign Metrics: ${metricsCount.count}`);

    if (metricsCount.count > 0) {
        const sample = db.prepare('SELECT * FROM CampaignMetrics LIMIT 5').all();
        console.log('\nSample Metrics:');
        sample.forEach(m => {
            console.log(`- Date: ${m.date} | DataSourceId: ${m.dataSourceId} | Campaign: ${m.campaignName} | Clicks: ${m.clicks}`);
        });

        const latest = db.prepare('SELECT MAX(date) as maxDate FROM CampaignMetrics').get();
        console.log(`\nMax Date in DB: ${latest.maxDate}`);
    } else {
        console.log('\nNO CAMPAIGN METRICS ROWS FOUND.');
    }

} catch (e) {
    console.error('Error:', e.message);
}

db.close();
