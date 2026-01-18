const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

try {
    console.log('Inspecting DataSource table schema using better-sqlite3...');
    const info = db.pragma('table_info(DataSource)');
    console.log('Columns in DataSource:');
    info.forEach(col => {
        console.log(`- ${col.name} (${col.type})`);
    });

    const hasClientName = info.some(col => col.name === 'clientName');
    console.log('\nHas clientName column:', hasClientName);
} catch (error) {
    console.error('Database Error:', error.message);
} finally {
    db.close();
}
