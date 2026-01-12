const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const db = new Database(dbPath, { verbose: null });

console.log('Checking DataSources...');
try {
    const sources = db.prepare('SELECT * FROM DataSource WHERE userId = 2').all();
    console.log(`Found ${sources.length} sources for User 2.`);
    sources.forEach(s => {
        console.log(`- [${s.id}] Type: ${s.sourceType} | Account: ${s.accountId} (${s.accountName}) | Status: ${s.status}`);
    });
} catch (e) {
    console.error('Error fetching DataSources:', e.message);
}

console.log('\nChecking Users...');
try {
    const users = db.prepare('SELECT * FROM User').all();
    users.forEach(u => {
        console.log(`- [${u.id}] ${u.email}`);
    });
} catch (e) {
    console.error('Error fetching Users:', e.message);
}
