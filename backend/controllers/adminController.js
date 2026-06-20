const pool = require('../config/db');
const jwt = require('jsonwebtoken');

exports.getDashboardStats = async (req, res) => {
    try {
        const [totalUsersRes, totalEarningsRes, totalWithdrawalsRes, pendingWithdrawalsRes, referralCommissionsRes, referralCountsRes] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users'),
            pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM earnings'),
            pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = \'Completed\''),
            pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = \'Pending\''),
            pool.query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN referral_level = 1 THEN amount ELSE 0 END), 0) as l1,
                    COALESCE(SUM(CASE WHEN referral_level = 2 THEN amount ELSE 0 END), 0) as l2,
                    COALESCE(SUM(CASE WHEN referral_level = 3 THEN amount ELSE 0 END), 0) as l3,
                    COALESCE(SUM(amount), 0) as total
                FROM earnings WHERE source_type = 'referral'`),
            pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM users WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id IS NULL)) as l1,
                    (SELECT COUNT(*) FROM users WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id IS NULL))) as l2,
                    (SELECT COUNT(*) FROM users WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id IS NULL)))) as l3
            `)
        ]);

        // Parse counts and amounts with safe fallbacks
        const totalUsers = parseInt(totalUsersRes.rows[0].count) || 0;
        const totalRevenue = parseFloat(totalEarningsRes.rows[0].total) || 0;
        const totalPayouts = parseFloat(totalWithdrawalsRes.rows[0].total) || 0;
        const pendingPayouts = parseFloat(pendingWithdrawalsRes.rows[0].total) || 0;
        
        const referralStats = {
            l1: parseFloat(referralCommissionsRes.rows[0].l1) || 0,
            l2: parseFloat(referralCommissionsRes.rows[0].l2) || 0,
            l3: parseFloat(referralCommissionsRes.rows[0].l3) || 0,
            total: parseFloat(referralCommissionsRes.rows[0].total) || 0
        };
        
        const referralCounts = {
            l1: parseInt(referralCountsRes.rows[0].l1) || 0,
            l2: parseInt(referralCountsRes.rows[0].l2) || 0,
            l3: parseInt(referralCountsRes.rows[0].l3) || 0
        };

        const netProfit = totalRevenue - totalPayouts;

        res.json({
            totalUsers,
            totalProfits: totalRevenue,
            totalLiabilities: pendingPayouts,
            totalUserBalances: (totalRevenue - (totalPayouts + pendingPayouts)),
            totalRevenue,
            totalPayouts,
            netProfit,
            pendingPayouts,
            referralCommissions: referralStats,
            referralCounts
        });
    } catch (error) {
        console.error('Admin Stats Error:', error);
        res.status(500).json({ message: 'Failed to synchronize admin metrics.' });
    }
};

exports.getSurveyCompletions = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ut.id, u.username, t.title as survey_title, t.reward, ut.created_at as timestamp, ut.status
            FROM user_tasks ut
            JOIN users u ON ut.user_id = u.id
            JOIN tasks t ON ut.task_id = t.id
            WHERE t.type = 'survey' AND ut.status != 'Pending'
            ORDER BY CASE WHEN ut.status = 'Awaiting Approval' THEN 0 ELSE 1 END, ut.created_at DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin Get Survey Completions Error:', error);
        res.status(500).json({ message: 'Failed to synchronize survey ledger.' });
    }
};

exports.processSurveyApproval = async (req, res) => {
    const { id } = req.params; // user_tasks.id
    const { status, reward } = req.body; // 'Completed' or 'Rejected'

    try {
        const checkRes = await pool.query(
            "SELECT ut.user_id, ut.task_id, t.reward FROM user_tasks ut JOIN tasks t ON ut.task_id = t.id WHERE ut.id = $1 AND ut.status = 'Awaiting Approval'", 
            [id]
        );
        
        if (checkRes.rows.length === 0) return res.status(404).json({ message: "Submission not found or already audited." });
        
        const { user_id, task_id, reward: dbReward } = checkRes.rows[0];

        await pool.query('BEGIN');

        if (status === 'Completed') {
            const finalReward = parseFloat(reward) || dbReward;
            await pool.query('INSERT INTO task_completions (user_id, task_id) VALUES ($1, $2)', [user_id, task_id]);
            const sectorRes = await pool.query("SELECT id FROM sectors WHERE name = 'Surveys'");
            const sectorId = sectorRes.rows[0]?.id;

            if (!sectorId) throw new Error("Surveys sector node not found in configuration.");

            await pool.query(
                'INSERT INTO earnings (user_id, sector_id, amount, source_type) VALUES ($1, $2, $3, $4)',
                [user_id, sectorId, finalReward, 'task']
            );
        }

        await pool.query("UPDATE user_tasks SET status = $1 WHERE id = $2", [status, id]);

        await pool.query('COMMIT');
        res.json({ message: `Survey node ${status === 'Completed' ? 'authorized' : 'rejected'}. Ledger synchronized.` });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Admin Survey Approval Error:', error);
        res.status(500).json({ message: 'Audit sequence failed.' });
    }
};

exports.getBlogSubmissions = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.id, u.username, b.title, b.category, b.content, b.status, b.created_at as timestamp
            FROM blogs b
            JOIN users u ON b.user_id = u.id
            ORDER BY CASE WHEN b.status = 'Pending' THEN 0 ELSE 1 END, b.created_at DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin Get Blogs Error:', error);
        res.status(500).json({ message: 'Failed to synchronize blog ledger.' });
    }
};

exports.processBlogApproval = async (req, res) => {
    const { id } = req.params;
    const { status, reward } = req.body; // 'Approved' or 'Rejected'

    try {
        const checkRes = await pool.query("SELECT user_id, status FROM blogs WHERE id = $1", [id]);
        if (checkRes.rows.length === 0) return res.status(404).json({ message: "Blog node not found." });
        if (checkRes.rows[0].status !== 'Pending') return res.status(400).json({ message: "Submission already audited." });

        const userId = checkRes.rows[0].user_id;

        await pool.query('BEGIN');

        if (status === 'Approved') {
            const val = parseFloat(reward) || 0;
            const sectorRes = await pool.query("SELECT id FROM sectors WHERE name = 'Blogs'");
            const sectorId = sectorRes.rows[0]?.id;

            if (!sectorId) throw new Error("Blogs sector node not found in configuration.");

            await pool.query(
                'INSERT INTO earnings (user_id, sector_id, amount, source_type) VALUES ($1, $2, $3, $4)',
                [userId, sectorId, val, 'task']
            );
            await pool.query("UPDATE blogs SET status = 'Approved', reward = $1 WHERE id = $2", [val, id]);
        } else {
            await pool.query("UPDATE blogs SET status = 'Rejected' WHERE id = $1", [id]);
        }

        await pool.query('COMMIT');
        res.json({ message: `Blog submission ${status.toLowerCase()}. Ledger synchronized.` });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Admin Blog Approval Error:', error);
        res.status(500).json({ message: 'Audit sequence failed.' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.*, 
            ((SELECT COALESCE(SUM(amount), 0) FROM earnings WHERE user_id = u.id) - 
             (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE user_id = u.id AND status != 'Rejected')) as balance
            FROM users u ORDER BY u.created_at DESC`);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch user directory.' });
    }
};

exports.getPendingPayouts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT w.id, u.username, w.amount, u.phone_number, w.wallet_type, w.created_at
            FROM withdrawals w
            JOIN users u ON w.user_id = u.id
            WHERE w.status = 'Pending'
            ORDER BY w.created_at ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin Get Pending Payouts Error:', error);
        res.status(500).json({ message: 'Failed to fetch pending payouts.' });
    }
};

exports.updatePayoutStatus = async (req, res) => {
    const { payoutId } = req.params;
    const { status } = req.body; // 'Completed' or 'Rejected'

    if (!['Completed', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        await pool.query('UPDATE withdrawals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, payoutId]);
        res.json({ message: `Payout ID ${payoutId} marked as ${status}.` });
    } catch (error) {
        console.error('Admin Update Payout Status Error:', error);
        res.status(500).json({ message: 'Failed to update payout status.' });
    }
};

exports.updateUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status, payment_status } = req.body;
    try {
        await pool.query('UPDATE users SET status = $1, payment_status = $2 WHERE id = $3', [status, payment_status, id]);
        res.json({ message: 'User node parameters updated.' });
    } catch (error) {
        res.status(500).json({ message: 'Update failed.' });
    }
};

exports.bulkApproveUsers = async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE users SET status = 'Active', payment_status = 'Paid' WHERE status = 'Inactive' RETURNING id"
        );
        const count = result.rowCount;
        res.json({ message: `Protocol Executed: ${count} agents authorized and activated.` });
    } catch (error) {
        console.error('Bulk Approve Error:', error);
        res.status(500).json({ message: 'Bulk approval sequence failed.' });
    }
};

exports.loginAsUser = async (req, res) => {
    const { id } = req.params;
    try {
        const userRes = await pool.query('SELECT id, username FROM users WHERE id = $1', [id]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ message: "User not found." });

        // Generate a standard User JWT (NOT an admin token)
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Short duration for troubleshooting sessions
        );

        res.json({ token, username: user.username });
    } catch (error) {
        console.error('Impersonation Error:', error);
        res.status(500).json({ message: 'Impersonation sequence failed.' });
    }
};

exports.adjustUserBalance = async (req, res) => {
    const { id } = req.params;
    const { amount, type } = req.body;
    const val = parseFloat(amount);

    if (isNaN(val) || val <= 0) return res.status(400).json({ message: "Invalid amount node." });

    try {
        await pool.query('BEGIN');
        if (type === 'credit') {
            // Use the first available sector for manual adjustments
            const sectorRes = await pool.query("SELECT id FROM sectors LIMIT 1");
            const sectorId = sectorRes.rows[0]?.id;
            await pool.query(
                'INSERT INTO earnings (user_id, sector_id, amount, source_type) VALUES ($1, $2, $3, $4)',
                [id, sectorId, val, 'manual_adjustment']
            );
        } else {
            await pool.query(
                "INSERT INTO withdrawals (user_id, amount, status, wallet_type, phone_number) VALUES ($1, $2, 'Completed', 'Manual Adjustment', 'SYSTEM')",
                [id, val]
            );
        }
        await pool.query('COMMIT');
        res.json({ message: `Successfully ${type}ed KSh ${val.toLocaleString()} to node.` });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Balance Adjustment Error:', error);
        res.status(500).json({ message: 'Adjustment sequence failed.' });
    }
};

exports.verifyVideoLink = async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "URL required for verification." });

    try {
        let apiUrl = "";
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            apiUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        } else if (url.includes('tiktok.com')) {
            apiUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
        } else {
            return res.status(400).json({ message: "Unsupported platform node." });
        }

        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            res.json({ active: true, title: data.title || data.author_name || "Active Node" });
        } else {
            res.json({ active: false, message: "Resource unreachable: It may be deleted, private, or restricted." });
        }
    } catch (error) {
        res.status(500).json({ message: 'Verification handshake failure.' });
    }
};

exports.getAllTasks = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, 
            (SELECT json_agg(q) FROM task_survey_questions q WHERE q.task_id = t.id) as questions
            FROM tasks t ORDER BY t.type ASC, t.created_at DESC`);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin Get All Tasks Error:', error);
        res.status(500).json({ message: 'Failed to fetch task directory.' });
    }
};

exports.addTask = async (req, res) => {
    let { type, title, description, video_link, duration, reward, questions } = req.body;

    // Sanitize numeric inputs to prevent Postgres type mismatch (22P02)
    duration = parseInt(duration) || 0;
    reward = parseFloat(reward) || 0;

    // DIAGNOSTIC: Monitor incoming question nodes
    console.log(`[LEDGER] Deploying ${type} node. Questions detected:`, (questions?.length || 0));

    try {
        await pool.query('BEGIN');
        const result = await pool.query(
            'INSERT INTO tasks (type, title, description, video_link, duration, reward) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [type, title, description, video_link, duration, reward]
        );
        const taskId = result.rows[0].id;

        if (type === 'survey' && Array.isArray(questions)) {
            for (const q of questions) {
                if (!q.text) continue;
                await pool.query(
                    'INSERT INTO task_survey_questions (task_id, question_text, option_a, option_b, option_c, option_d) VALUES ($1, $2, $3, $4, $5, $6)',
                    [taskId, q.text, q.a, q.b, q.c, q.d]
                );
            }
        }

        await pool.query('COMMIT');
        res.status(201).json({ message: 'Task deployed to pipeline.', task: result.rows[0] });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Admin Add Task Error:', error);
        res.status(500).json({ message: 'Deployment failed.' });
    }
};

exports.deleteTask = async (req, res) => {
    const { taskId } = req.params;
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
        res.json({ message: 'Task node purged from ledger.' });
    } catch (error) {
        console.error('Admin Delete Task Error:', error);
        res.status(500).json({ message: 'Purge failed.' });
    }
};

exports.updateTask = async (req, res) => {
    const { taskId } = req.params;
    let { type, title, description, video_link, duration, reward, questions } = req.body;

    // Sanitize numeric inputs to prevent Postgres type mismatch (22P02)
    duration = parseInt(duration) || 0;
    reward = parseFloat(reward) || 0;

    // DIAGNOSTIC: Monitor node mutation
    console.log(`[LEDGER] Updating node ${taskId}. Questions staged:`, (questions?.length || 0));

    try {
        await pool.query('BEGIN');
        await pool.query(
            'UPDATE tasks SET type = $1, title = $2, description = $3, video_link = $4, duration = $5, reward = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
            [type, title, description, video_link, duration, reward, taskId]
        );

        if (type === 'survey' && Array.isArray(questions)) {
            await pool.query('DELETE FROM task_survey_questions WHERE task_id = $1', [taskId]);
            for (const q of questions) {
                if (!q.text) continue;
                await pool.query(
                    'INSERT INTO task_survey_questions (task_id, question_text, option_a, option_b, option_c, option_d) VALUES ($1, $2, $3, $4, $5, $6)',
                    [taskId, q.text, q.a, q.b, q.c, q.d]
                );
            }
        }

        await pool.query('COMMIT');
        res.json({ message: 'Task node updated successfully.' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Admin Update Task Error:', error);
        res.status(500).json({ message: 'Update failed.' });
    }
};

exports.getAllTransactions = async (req, res) => {
    try {
        const query = `
            (SELECT 'earning' as flow, e.id, u.username, e.amount, s.name as source, 'Completed' as status, e.created_at
             FROM earnings e
             JOIN users u ON e.user_id = u.id
             JOIN sectors s ON e.sector_id = s.id)
            UNION ALL
            (SELECT 'withdrawal' as flow, w.id, u.username, w.amount, w.wallet_type as source, w.status, w.created_at
             FROM withdrawals w
             JOIN users u ON w.user_id = u.id)
            ORDER BY created_at DESC
            LIMIT 500
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin Transactions Error:', error);
        res.status(500).json({ message: 'Failed to synchronize transaction ledger.' });
    }
};

exports.getSystemStatus = async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM system_config WHERE key = 'maintenance_mode'");
        const isKillSwitchActive = result.rows.length > 0 ? result.rows[0].value === 'true' : false;
        res.json({ isKillSwitchActive });
    } catch (error) {
        console.error('Get System Status Error:', error);
        res.status(500).json({ message: 'Failed to fetch system telemetry.' });
    }
};

exports.toggleKillSwitch = async (req, res) => {
    const { active } = req.body;
    try {
        await pool.query(
            "INSERT INTO system_config (key, value) VALUES ('maintenance_mode', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [active ? 'true' : 'false']
        );
        res.json({ message: `System Kill Switch ${active ? 'ENGAGED' : 'DISENGAGED'}.`, active });
    } catch (error) {
        console.error('Toggle Kill Switch Error:', error);
        res.status(500).json({ message: 'Failed to execute kill switch command.' });
    }
};

exports.getAllReferrals = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u1.id as referred_id,
                u1.username as referred_username,
                u1.email as referred_email,
                u1.status as status,
                u1.created_at as date,
                u2.username as referrer_username,
                COALESCE(SUM(e.amount), 0) as total_commission
            FROM users u1
            INNER JOIN users u2 ON u1.referrer_id = u2.id
            LEFT JOIN earnings e ON e.user_id = u2.id AND e.referred_user_id = u1.id
            GROUP BY u1.id, u2.username
            ORDER BY u1.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin Referrals Error:', error);
        res.status(500).json({ message: 'Failed to fetch referral network.' });
    }
};

exports.getRecentActivities = async (req, res) => {
    try {
        const query = `
            (SELECT 'registration' as type, username as actor, 'New agent joined the matrix' as description, created_at as timestamp FROM users)
            UNION ALL
            (SELECT 'withdrawal' as type, u.username as actor, 'Requested withdrawal of KSh ' || w.amount as description, w.created_at as timestamp 
             FROM withdrawals w JOIN users u ON w.user_id = u.id)
            UNION ALL
            (SELECT 'earning' as type, u.username as actor, 'Earned KSh ' || e.amount || ' from ' || s.name as description, e.created_at as timestamp 
             FROM earnings e JOIN users u ON e.user_id = u.id JOIN sectors s ON e.sector_id = s.id WHERE source_type = 'task')
            ORDER BY timestamp DESC LIMIT 15
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin Activities Error:', error);
        res.status(500).json({ message: 'Failed to synchronize activity feed.' });
    }
};