const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

try {
    console.log('Inspecting oAuthToken table...');
    const tokens = db.prepare('SELECT id, userId, provider, email, updatedAt FROM oAuthToken').all();
    console.log('Found tokens:', JSON.stringify(tokens, null, 2));

    console.log('\nInspecting User table...');
    const users = db.prepare('SELECT id, email FROM User').all();
    console.log('Found users:', JSON.stringify(users, null, 2));
} catch (error) {
    console.error('Database Error:', error.message);
} finally {
    db.close();
}
