const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const db = new Database(dbPath, { verbose: null });

console.log('--- TABLES IN DB ---');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => {
    try {
        const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
        console.log(`${t.name}: ${count.c} rows`);
    } catch (e) {
        console.log(`${t.name}: ERROR (${e.message})`);
    }
});

db.close();
