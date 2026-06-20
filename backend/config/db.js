const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
      })
    : new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

// Test connection
pool.on('connect', () => {
    console.log('[DATABASE] PostgreSQL link established. Master node connected.');
});

pool.on('error', (err) => {
    console.error('[DATABASE] Critical Link Failure:', err);
});

module.exports = pool;