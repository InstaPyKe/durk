const { Pool } = require('pg');
const dns = require('dns');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 1. CRITICAL: Tell Node.js to resolve IPv6 addresses so it can find Railway Internal
dns.setDefaultResultOrder('ipv6first'); 

const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com') || process.env.DATABASE_URL?.includes('railway');

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false
      })
    : new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

// 2. Add this log to see the exact connection status
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ DB Connection Error:', err.message);
  } else {
    console.log('✅ DATABASE CONNECTED SUCCESSFULLY AT:', res.rows[0].now);
  }
});

module.exports = pool;