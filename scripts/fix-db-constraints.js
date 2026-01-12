const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('Checking indexes on OAuthToken...');

const indexes = db.prepare("PRAGMA index_list('OAuthToken')").all();

indexes.forEach(idx => {
    console.log(`Found index: ${idx.name} (unique: ${idx.unique})`);

    // Check key info
    const info = db.prepare(`PRAGMA index_info('${idx.name}')`).all();
    const columns = info.map(c => c.name).join(', ');
    console.log(`  - Columns: [${columns}]`);

    // Identify the old index on [userId, provider] (without email)
    // The new one should be [userId, provider, email]
    if (idx.name.includes('userId_provider_key') && !columns.includes('email')) {
        console.log(`‼️ FOUND LEGACY INDEX: ${idx.name} - Dropping it...`);
        try {
            db.prepare(`DROP INDEX "${idx.name}"`).run();
            console.log('✅ Dropped legacy index.');
        } catch (e) {
            console.error('❌ Failed to drop index:', e.message);
        }
    }
});

console.log('Done.');
