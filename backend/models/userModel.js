const pool = require('../config/db');

const User = {
    async findByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    },

    async findByUsername(username) {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0];
    },

    async create(userData) {
        const { username, email, phone_number, password, full_name, referrer_id } = userData;
        const query = `
            INSERT INTO users (username, email, phone_number, password, full_name, referrer_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, email
        `;
        const values = [
            username, email, phone_number, password, full_name, 
            (referrer_id && !isNaN(referrer_id) && referrer_id !== 'null') ? parseInt(referrer_id) : null
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    },

    async updatePaymentReference(userId, reference) {
        await pool.query('UPDATE users SET merchant_reference = $1 WHERE id = $2', [reference, userId]);
    },

    async activateUserByReference(reference, trackingId) {
        const query = `
            UPDATE users 
            SET payment_status = 'Approved', status = 'Active', pesapal_tracking_id = $1 
            WHERE merchant_reference = $2 RETURNING *`;
        const result = await pool.query(query, [trackingId, reference]);
        return result.rows[0];
    }
};

module.exports = User;