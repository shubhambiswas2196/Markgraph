
const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

try {
    const tableInfo = db.prepare("PRAGMA table_info(DataSource)").all();
    console.log('DataSource Columns:');
    tableInfo.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (e) {
    console.error(e);
} finally {
    db.close();
}
