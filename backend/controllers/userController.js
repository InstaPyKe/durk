const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Database connection pool

// Safaricom specific prefix validation regex for Kenyan nodes
const safaricomRegex = /^(?:254|\+254|0)?(7(?:[0129]\d|4[0-3568]|5[7-9]|6[89])|11[0-5])\d{6}$/;
const gmailRegex = /^[a-z0-9](\.?[a-z0-9]){5,29}@gmail\.com$/;

// Define dynamic financial nodes from environment variables
const ACTIVATION_FEE = parseFloat(process.env.ACTIVATION_FEE || '500.00');
const REFERRAL_L1_AMOUNT = parseFloat(process.env.REFERRAL_L1_AMOUNT || '200.00');
const REFERRAL_L2_AMOUNT = parseFloat(process.env.REFERRAL_L2_AMOUNT || '100.00');
const REFERRAL_L3_AMOUNT = parseFloat(process.env.REFERRAL_L3_AMOUNT || '50.00');

exports.register = async (req, res) => {
    try {
        let { username, email, phone_number, password, confirmPassword, full_name, referrer_id: raw_referrer_id } = req.body;

        // Standardize credentials to prevent synchronization failure from hidden characters
        username = username?.trim();
        email = email?.trim()?.toLowerCase();
        password = password?.trim();
        confirmPassword = confirmPassword?.trim();

        // Ensure referrer_id is an integer or null to prevent DB type mismatch
        const referrer_id = (raw_referrer_id && !isNaN(raw_referrer_id)) ? parseInt(raw_referrer_id) : null;

        // 0. Null check for required telemetry
        if (!username || !email || !phone_number || !password) {
            return res.status(400).json({ message: 'All required registration parameters must be provided.' });
        }

        // Enforce real Gmail account configuration
        if (!gmailRegex.test(email)) {
            return res.status(400).json({ message: 'Access Denied: A valid, existing @gmail.com account is required.' });
        }

        // Phone node validation for Safaricom gateway
        const cleanPhone = phone_number.replace(/[\s\-\(\)]/g, '');
        if (!safaricomRegex.test(cleanPhone)) {
            return res.status(400).json({ message: 'Access Denied: Only Kenyan Safaricom nodes are supported by the gateway.' });
        }

        // 1. Validation
        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Security passphrases do not match.' });
        }

        // 2. Check existence
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ message: 'Access Denied: Email node already registered in terminal.' });
        }

        // 3. Hash Password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Save User
        const newUser = await User.create({
            username,
            email,
            phone_number,
            password: hashedPassword,
            full_name,
            referrer_id
        });

        if (!newUser) {
            throw new Error('Database failed to return new user record.');
        }

        // 5. Generate JWT
        const token = jwt.sign(
            { id: newUser.id, username: newUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful.',
            token,
            user: { username: newUser.username, email: newUser.email }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Critical Synchronization Failure.' });
    }
};

exports.checkUsername = async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findByUsername(username);
        res.json({ available: !user });
    } catch (error) {
        console.error('Username check error:', error);
        res.status(500).json({ message: 'Error checking username availability.' });
    }
};

exports.adminLogin = async (req, res) => {
    try {
        let { username, email, password } = req.body;
        
        // The identifier could be in either field depending on frontend implementation
        let identifier = (username || email)?.trim();
        password = password?.trim();

        if (!identifier || !password) {
            return res.status(401).json({ message: 'Invalid administrative credentials.' });
        }

        // TEMPORARY BYPASS: Hardcoded Admin Credentials
        if (identifier === 'adminbravin@durk.com' && password === 'qwerty123#') {
            let realUser = await User.findByEmail(identifier);

            // If the admin node is missing from the ledger, provision it automatically
            if (!realUser) {
                const salt = await bcrypt.genSalt(12);
                const hashed = await bcrypt.hash(password, salt);
                realUser = await User.create({
                    username: 'adminbravin',
                    email: 'adminbravin@durk.com',
                    phone_number: '254700000000',
                    password: hashed,
                    full_name: 'System Administrator'
                });
                // Elevate clearance and activate node
                await pool.query("UPDATE users SET is_admin = true, status = 'Active', payment_status = 'Paid' WHERE id = $1", [realUser.id]);
            }

            const token = jwt.sign(
                { id: realUser.id, username: 'adminbravin', is_admin: true },
                process.env.JWT_SECRET,
                { expiresIn: '12h' }
            );
            return res.json({ 
                message: 'Admin authentication successful (Bypass Mode Active).', 
                token, 
                user: { username: 'adminbravin', is_admin: true } 
            });
        }

        // If input looks like an email, prioritize lowercased email lookup to match registration protocol
        const user = identifier.includes('@') 
            ? (await User.findByEmail(identifier.toLowerCase())) 
            : (await User.findByUsername(identifier));

        // Enhanced Debug: Check for string lengths to identify truncation or padding
        console.log(`[DEBUG] Admin Auth Attempt for "${identifier}":`, {
            found: !!user,
            is_admin_field: user ? user.is_admin : 'N/A',
            has_password_field: user ? !!user.password : 'N/A',
            db_hash_length: user?.password ? user.password.length : 0,
            received_pw_length: password ? password.length : 0
        });

        if (!user) {
            console.warn(`[AUTH] Admin login failed: User "${identifier}" not found.`);
            return res.status(401).json({ message: 'Invalid administrative credentials.' });
        }

        if (!user.is_admin) {
            console.warn(`[AUTH] Admin login failed: User "${identifier}" exists but is_admin is FALSE.`);
            return res.status(403).json({ message: 'Access Denied: Administrative clearance is not assigned to this node.' });
        }

        if (!user.password) {
            console.error(`[AUTH] Critical Error: Password field missing from user object.`);
            return res.status(500).json({ message: 'Internal Authentication Error.' });
        }

        // trim() the DB hash to handle potential CHAR(N) padding issues in Postgres
        const isMatch = await bcrypt.compare(password, user.password.trim());
        if (!isMatch) {
            console.warn(`[AUTH] Admin login failed: Incorrect passphrase for "${identifier}".`);
            return res.status(401).json({ message: 'Invalid administrative credentials.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, is_admin: true },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({ 
            message: 'Admin authentication successful.', 
            token, 
            user: { username: user.username, is_admin: true } 
        });
    } catch (error) {
        console.error('Admin Login Error:', error);
        res.status(500).json({ message: 'Internal Server Error.' });
    }
};

exports.login = async (req, res) => {
    try {
        let { email, username, password } = req.body;

        // Standardize credentials for consistent ledger verification
        let identifier = (email || username)?.trim();
        password = password?.trim();

        // Find user by email or username to ensure we fetch from DBeaver (Postgres) nodes
        const user = identifier.includes('@') 
            ? await User.findByEmail(identifier.toLowerCase())
            : await User.findByUsername(identifier);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials or user not found.' });
        }

        // Verify password - trim stored hash to handle potential CHAR(N) padding in Postgres
        const isMatch = await bcrypt.compare(password, user.password?.trim());
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ message: 'Login successful', token, user: { username: user.username, email: user.email } });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Internal Server Error during authentication.' });
    }
};

// --- Task Management Node ---
exports.getTasksByType = async (req, res) => {
    try {
        const { type } = req.params;
        const userId = req.user.id;

        // Security Guard: Prevent bypass admin (ID 0) from triggering FK violations
        if (userId === 0) {
            return res.status(403).json({ message: "Bypass Admin cannot initialize task sequences. Use a real agent account for testing." });
        }
        
        // Enforce daily limit for node-specific sequences
        if (type === 'tiktok' || type === 'spins') {
            const limit = type === 'spins' ? 3 : 10;
            const limitCheck = await pool.query(
                `SELECT COUNT(*) FROM task_completions tc 
                 JOIN tasks t ON tc.task_id = t.id 
                 WHERE tc.user_id = $1 AND t.type = $2 
                 AND tc.completed_at > NOW() - INTERVAL '24 hours'`,
                [userId, type]
            );
            if (parseInt(limitCheck.rows[0].count) >= limit) {
                return res.json([]); // Return empty queue if limit reached
            }
        }

        // Fetch tasks of specific type that this agent has NOT completed yet
        const query = `
            SELECT t.*,
            (SELECT COALESCE(json_agg(q), '[]'::json) FROM task_survey_questions q WHERE q.task_id = t.id) as questions,
            (SELECT COUNT(*) FROM task_completions tc2 WHERE tc2.user_id = $1 AND tc2.task_id = t.id) as already_done
            FROM tasks t
            WHERE t.type = $2 
            ${(type === 'spins' || type === 'game') ? '' : `
            AND NOT EXISTS (SELECT 1 FROM task_completions tc WHERE tc.user_id = $1 AND tc.task_id = t.id)
            AND NOT EXISTS (SELECT 1 FROM user_tasks ut WHERE ut.user_id = $1 AND ut.task_id = t.id AND (ut.status = 'Completed' OR ut.status = 'Awaiting Approval'))
            `}
            ORDER BY t.created_at DESC
        `;
        const finalQuery = (type === 'youtube' || type === 'game' || type === 'survey') ? query : query + ' LIMIT 1';
        const result = await pool.query(finalQuery, [userId, type]);
        res.json(result.rows);
    } catch (error) {
        console.error('Task Fetch Error:', error);
        res.status(500).json({ message: 'Failed to synchronize task queue.' });
    }
};

exports.startTaskSequence = async (req, res) => {
    const { taskId } = req.body;
    const userId = req.user.id;
    try {
        // Authoritative Handshake: Set the wall-clock start time ONLY when the user hits 'Watch Now'
        await pool.query(
            `INSERT INTO user_tasks (user_id, task_id, status, created_at) VALUES ($1, $2, 'Pending', CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, task_id) DO UPDATE SET created_at = CURRENT_TIMESTAMP, status = 'Pending'`,
            [userId, taskId]
        );
        res.json({ message: "Task sequence initialized in ledger." });
    } catch (error) {
        console.error('Task Start Error:', error);
        res.status(500).json({ message: 'Failed to initialize task signature.' });
    }
};

// --- Financial Handshake Node ---
exports.claimPayout = async (req, res) => {
    const { taskId, amount } = req.body;
    const userId = req.user.id;

    // Security Guard: Prevent bypass admin from interacting with payout ledger
    if (userId === 0) {
        return res.status(403).json({ message: "Bypass Admin cannot verify payout signatures." });
    }

    try {
        // 1. Verify if task exists and is valid
        const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        if (taskRes.rows.length === 0) {
            return res.status(404).json({ message: "Handshake Error: Task node not found." });
        }
        const task = taskRes.rows[0];

        // 2. Prevent duplicate claims
        if (task.type !== 'spins' && task.type !== 'game') {
            const checkRes = await pool.query('SELECT id FROM task_completions WHERE user_id = $1 AND task_id = $2', [userId, taskId]);
            if (checkRes.rows.length > 0) {
                return res.status(400).json({ message: "Handshake Error: Signature already verified in ledger." });
            }
        }

        // Primary Guard: Prevent payout if 24-hour limit is exceeded
        if (task.type === 'tiktok' || task.type === 'spins') {
            const limit = task.type === 'spins' ? 3 : 10;
            const limitCheck = await pool.query(
                `SELECT COUNT(*) FROM task_completions tc 
                 JOIN tasks t ON tc.task_id = t.id 
                 WHERE tc.user_id = $1 AND t.type = $2 
                 AND tc.completed_at > NOW() - INTERVAL '24 hours'`,
                [userId, task.type]
            );
            if (parseInt(limitCheck.rows[0].count) >= limit) {
                return res.status(403).json({ message: `Security Protocol: Daily ${task.type} limit reached (${limit}/${limit}). Access reset in 24h.` });
            }
        }

        // 3. Verify watch time duration
        const startTimeRes = await pool.query(
            "SELECT created_at FROM user_tasks WHERE user_id = $1 AND task_id = $2 AND status = 'Pending'",
            [userId, taskId]
        );

        if (startTimeRes.rows.length === 0) {
            return res.status(403).json({ message: "Handshake Error: Task node was never initialized." });
        }

        const startedAt = new Date(startTimeRes.rows[0].created_at);
        const now = new Date();
        const secondsElapsed = (now.getTime() - startedAt.getTime()) / 1000;

        if (secondsElapsed < task.duration) {
            const remaining = Math.ceil(task.duration - secondsElapsed);
            return res.status(403).json({ 
                message: `Security Alert: Verification sequence too fast. Please wait ${remaining} more seconds.` 
            });
        }

        // 4. Handle Surveys (Manual Approval Protocol)
        if (task.type === 'survey') {
            await pool.query("UPDATE user_tasks SET status = 'Awaiting Approval' WHERE user_id = $1 AND task_id = $2", [userId, taskId]);
            return res.json({ 
                message: "Survey sequence synchronized. Reward will be allocated after administrative verification.",
                is_pending: true
            });
        }

        // 4. Atomically update completions, tasks, and earnings
        await pool.query('BEGIN');
        
        await pool.query(
            'INSERT INTO task_completions (user_id, task_id) VALUES ($1, $2)',
            [userId, taskId]
        );

        await pool.query("UPDATE user_tasks SET status = 'Completed' WHERE user_id = $1 AND task_id = $2", [userId, taskId]);

        // Map task type to Sector Name for accurate ledger accounting
        const typeToSectorMap = {
            'tiktok': 'TikTok',
            'youtube': 'YouTube',
            'survey': 'Surveys',
            'blog': 'Blogs',
            'spins': 'Spins',
            'game': 'Games'
        };
        const sectorName = typeToSectorMap[task.type] || 'YouTube';
        const sectorRes = await pool.query('SELECT id FROM sectors WHERE name = $1', [sectorName]);
        const sectorId = sectorRes.rows.length > 0 ? sectorRes.rows[0].id : null;
        
        // Use the dynamic reward set in the Admin Task Control Center.
        // For Spins, use the dynamic amount from frontend (validated against prize list).
        let finalReward = parseFloat(task.reward);

        if (task.type === 'spins' && amount) {
            const validPrizes = [10, 15, 20, 25, 30, 35, 40, 50];
            finalReward = validPrizes.includes(Number(amount)) ? parseFloat(amount) : 0;
        }

        await pool.query(
            'INSERT INTO earnings (user_id, sector_id, amount, source_type) VALUES ($1, $2, $3, $4)',
            [userId, sectorId, finalReward, 'task']
        );

        await pool.query('COMMIT');

        // Calculate the updated yield for this specific sector for immediate frontend synchronization
        const balanceRes = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = $1 AND sector_id = $2',
            [userId, sectorId]
        );
        const newSectorBalance = parseFloat(balanceRes.rows[0].total).toFixed(2);

        // Calculate total account balance for full node synchronization
        const [allEarnings, allWithdrawals] = await Promise.all([
            pool.query('SELECT SUM(amount) as total FROM earnings WHERE user_id = $1', [userId]),
            pool.query('SELECT SUM(amount) as total FROM withdrawals WHERE user_id = $1', [userId])
        ]);
        const totalBalance = (parseFloat(allEarnings.rows[0].total || 0) - parseFloat(allWithdrawals.rows[0].total || 0)).toFixed(2);

        res.json({ 
            message: `Ledger Synchronized. Reward of KSh ${finalReward} allocated to node.`,
            reward: finalReward,
            newSectorBalance: newSectorBalance,
            totalBalance: totalBalance
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Payout Error:', error);
        res.status(500).json({ message: "Critical Ledger Synchronization Failure." });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id; // From JWT Auth middleware
        
        // Execute queries in parallel for optimal velocity
        const [earningsRes, withdrawRes, tasksRes, referralsRes, refEarningsRes, sectorRes, ytCountRes, ttCountRes, spinsCountRes, surveyCountRes, gamesCountRes, mainWithdrawRes, ytTotalRes, gamesTotalRes, surveyTotalRes, referrerRes] = await Promise.all([
            pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = $1", [userId]),
            pool.query('SELECT SUM(amount) as total FROM withdrawals WHERE user_id = $1', [userId]),
            pool.query('SELECT COUNT(*) as total FROM user_tasks WHERE user_id = $1 AND status = \'Pending\'', [userId]),
            pool.query(`
                WITH RECURSIVE team_tree AS (
                    SELECT id, referrer_id, 1 as depth
                    FROM users
                    WHERE referrer_id = $1
                    UNION ALL
                    SELECT u.id, u.referrer_id, tt.depth + 1
                    FROM users u
                    INNER JOIN team_tree tt ON u.referrer_id = tt.id
                    WHERE tt.depth < 3
                )
                SELECT depth, COUNT(*) as count FROM team_tree GROUP BY depth`, [userId]),
            pool.query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN referral_level = 1 THEN amount ELSE 0 END), 0) as l1,
                    COALESCE(SUM(CASE WHEN referral_level = 2 THEN amount ELSE 0 END), 0) as l2,
                    COALESCE(SUM(CASE WHEN referral_level = 3 THEN amount ELSE 0 END), 0) as l3,
                    COALESCE(SUM(amount), 0) as total
                FROM earnings 
                WHERE user_id = $1 AND source_type = 'referral'`, [userId]),
            pool.query(`
                SELECT s.name, COALESCE(SUM(e.amount), 0) as amount 
                FROM sectors s 
                LEFT JOIN earnings e ON s.id = e.sector_id AND e.user_id = $1
                WHERE s.name != 'Referrals'
                GROUP BY s.name`, [userId]),
            pool.query("SELECT COUNT(*) FROM task_completions tc JOIN tasks t ON tc.task_id = t.id WHERE tc.user_id = $1 AND t.type = 'youtube' AND tc.completed_at > NOW() - INTERVAL '24 hours'", [userId]),
            pool.query("SELECT COUNT(*) FROM task_completions tc JOIN tasks t ON tc.task_id = t.id WHERE tc.user_id = $1 AND t.type = 'tiktok' AND tc.completed_at > NOW() - INTERVAL '24 hours'", [userId]),
            pool.query("SELECT COUNT(*) FROM task_completions tc JOIN tasks t ON tc.task_id = t.id WHERE tc.user_id = $1 AND t.type = 'spins' AND tc.completed_at > NOW() - INTERVAL '24 hours'", [userId]),
            pool.query("SELECT COUNT(*) FROM task_completions tc JOIN tasks t ON tc.task_id = t.id WHERE tc.user_id = $1 AND t.type = 'survey' AND tc.completed_at > NOW() - INTERVAL '24 hours'", [userId]),
            pool.query("SELECT COUNT(*) FROM task_completions tc JOIN tasks t ON tc.task_id = t.id WHERE tc.user_id = $1 AND t.type = 'game' AND tc.completed_at > NOW() - INTERVAL '24 hours'", [userId]),
            pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE user_id = $1 AND wallet_type = 'Main Balance' AND status != 'Rejected'", [userId]),
            pool.query("SELECT COUNT(*) FROM tasks WHERE type = 'youtube'"),
            pool.query("SELECT COUNT(*) FROM tasks WHERE type = 'game'"),
            pool.query("SELECT COUNT(*) FROM tasks WHERE type = 'survey'"),
            pool.query("SELECT u.username FROM users u JOIN users referred ON u.id = referred.referrer_id WHERE referred.id = $1", [userId])
        ]);

        const totalEarnings = parseFloat(earningsRes.rows[0].total || 0);
        const totalWithdrawn = parseFloat(withdrawRes.rows[0].total || 0);
        const mainWithdrawn = parseFloat(mainWithdrawRes.rows[0].total || 0);

        // Process recursive referral counts
        const teamCounts = { l1: 0, l2: 0, l3: 0 };
        let totalReferralNetwork = 0;
        referralsRes.rows.forEach(row => {
            teamCounts[`l${row.depth}`] = parseInt(row.count);
            totalReferralNetwork += parseInt(row.count);
        });

        const stats = {
            username: req.user.username,
            referrer: referrerRes.rows[0]?.username || null,
            totalBalance: (totalEarnings - mainWithdrawn).toFixed(2), 
            totalEarnings: totalEarnings.toFixed(2),
            totalWithdrawn: totalWithdrawn.toFixed(2),
            totalSpinsRemaining: Math.max(0, 3 - parseInt(spinsCountRes.rows[0].count)),
            pendingTasks: parseInt(tasksRes.rows[0].total),
            referrals: {
                total: totalReferralNetwork,
                earnings: parseFloat(refEarningsRes.rows[0].total || 0),
                team: { 
                    l1: teamCounts.l1, 
                    l2: teamCounts.l2, 
                    l3: teamCounts.l3 
                }
            },
            sectorEarnings: sectorRes.rows.map(row => {
                const meta = getSectorMeta(row.name);
                let completed = 0;
                let limit = null;

                if (row.name === 'YouTube') {
                    completed = parseInt(ytCountRes.rows[0].count);
                    limit = parseInt(ytTotalRes.rows[0].count) || 10;
                } else if (row.name === 'TikTok') {
                    completed = parseInt(ttCountRes.rows[0].count);
                    limit = 10;
                } else if (row.name === 'Spins') {
                    completed = parseInt(spinsCountRes.rows[0].count);
                    limit = 3;
                } else if (row.name === 'Surveys') {
                    completed = parseInt(surveyCountRes.rows[0].count);
                    limit = parseInt(surveyTotalRes.rows[0].count) || 10;
                } else if (row.name === 'Games') {
                    completed = parseInt(gamesCountRes.rows[0].count);
                    limit = parseInt(gamesTotalRes.rows[0].count) || 10;
                }

                return {
                    name: row.name,
                    amount: parseFloat(row.amount),
                    completed,
                    limit,
                    ...meta
                };
            }),
            chartData: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                values: [50, 80, 45, 90, 120, 70, 110]
            },
            objective: {
                percent: Math.min(100, Math.round((totalEarnings / 5000) * 100)),
                fraction: `${Math.round(totalEarnings / 100)} / 50`
            }
        };

        res.json(stats);
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Failed to synchronize dashboard metrics.' });
    }
};

const getSectorMeta = (name) => {
    const meta = {
        'YouTube': { icon: 'bi-youtube', color: 'emerald' },
        'TikTok': { icon: 'bi-tiktok', color: 'rose' },
        'Surveys': { icon: 'bi-clipboard-data', color: 'blue' },
        'Blogs': { icon: 'bi-pencil-square', color: 'amber' },
        'Spins': { icon: 'bi-patch-check', color: 'indigo' }
    };
    return meta[name] || { icon: 'bi-grid', color: 'gray' };
};

// --- Wallet Data Node ---
exports.getWalletData = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch total earnings, sector breakdown, and withdrawals
        const [earningsRes, withdrawRes, withdrawalHistoryRes, refEarningsRes, sectorRes] = await Promise.all([
            pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = $1', [userId]),
            pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE user_id = $1 AND status != 'Rejected'", [userId]),
            pool.query('SELECT id, amount, status, created_at FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
            pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = $1 AND source_type = 'referral'", [userId]),
            pool.query(`
                SELECT s.name, 
                COALESCE(SUM(e.amount), 0) - COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = $1 AND w.wallet_type = s.name AND w.status != 'Rejected'), 0) as available
                FROM sectors s 
                LEFT JOIN earnings e ON s.id = e.sector_id AND e.user_id = $1
                GROUP BY s.name`, [userId])
        ]);

        const sectorBalances = {};
        sectorRes.rows.forEach(row => {
            sectorBalances[row.name] = parseFloat(row.available);
        });

        const totalEarnings = parseFloat(earningsRes.rows[0].total);
        const totalWithdrawn = parseFloat(withdrawRes.rows[0].total);
        const currentBalance = (totalEarnings - totalWithdrawn).toFixed(2);

        res.json({
            username: req.user.username,
            totalBalance: currentBalance,
            totalEarnings: totalEarnings.toFixed(2),
            referralEarnings: parseFloat(refEarningsRes.rows[0].total).toFixed(2),
            totalWithdrawn: totalWithdrawn.toFixed(2),
            withdrawalHistory: withdrawalHistoryRes.rows,
            sectorBalances: sectorBalances
        });

    } catch (error) {
        console.error('Wallet Data Fetch Error:', error);
        res.status(500).json({ message: 'Failed to synchronize wallet data.' });
    }
};

// --- Withdrawal Request Node ---
exports.requestWithdrawal = async (req, res) => {
    const { amount, phone_number, wallet_type } = req.body;
    const userId = req.user.id;

    // Security Guard: Prevent bypass admin from requesting withdrawals
    if (userId === 0) {
        return res.status(403).json({ message: "Bypass Admin cannot synchronize withdrawal requests." });
    }

    // Strict Safaricom 07... format validation
    const phoneRegex = /^07\d{8}$/;

    try {
        let minWithdrawal = 600; 
        if (wallet_type !== 'Main Balance') {
            minWithdrawal = 900;
        }

        if (!phoneRegex.test(phone_number)) {
            return res.status(400).json({ message: "Phone number must start with 07 and be 10 digits." });
        }

        // Calculate available balance for the specific wallet type
        let availableBalance = 0;
        if (wallet_type === 'Main Balance') {
            const earnings = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = $1', [userId]);
            const withdrawn = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE user_id = $1 AND status != 'Rejected'", [userId]);
            availableBalance = parseFloat(earnings.rows[0].total) - parseFloat(withdrawn.rows[0].total);
        } else {
            const sectorEarnings = await pool.query('SELECT COALESCE(SUM(e.amount), 0) as total FROM earnings e JOIN sectors s ON e.sector_id = s.id WHERE e.user_id = $1 AND s.name = $2', [userId, wallet_type]);
            const sectorWithdrawn = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE user_id = $1 AND wallet_type = $2 AND status != 'Rejected'", [userId, wallet_type]);
            availableBalance = parseFloat(sectorEarnings.rows[0].total) - parseFloat(sectorWithdrawn.rows[0].total);
        }

        if (amount < minWithdrawal) {
            return res.status(400).json({ message: `Minimum withdrawal for this wallet is KSh ${minWithdrawal}.` });
        }
        if (amount > availableBalance) {
            return res.status(400).json({ message: `Insufficient funds. Your available balance is KSh ${availableBalance.toLocaleString()}.` });
        }

        await pool.query('INSERT INTO withdrawals (user_id, amount, phone_number, status, wallet_type) VALUES ($1, $2, $3, $4, $5)',
            [userId, amount, phone_number, 'Pending', wallet_type || 'Main Balance']);

        res.status(200).json({ message: 'Withdrawal request synchronized. Processing initiated.' });

    } catch (error) {
        console.error('Withdrawal Request Error:', error);
        res.status(500).json({ message: 'Critical Withdrawal Synchronization Failure.' });
    }
};

// --- Referral Matrix Node ---
exports.getReferralStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const host = req.get('host');
        const protocol = req.protocol;

        // 1. Fetch referral network data (L1-L3) and my own referrer identity
        const [referralsRes, referrerRes] = await Promise.all([
            pool.query(`
            WITH RECURSIVE team_tree AS (
                SELECT id, username, phone_number, status, referrer_id, 1 as depth
                FROM users
                WHERE referrer_id = $1
                UNION ALL
                SELECT u.id, u.username, u.phone_number, u.status, u.referrer_id, tt.depth + 1
                FROM users u
                INNER JOIN team_tree tt ON u.referrer_id = tt.id
                WHERE tt.depth < 3
            )
            SELECT * FROM team_tree ORDER BY depth ASC, username ASC`, [userId]),
            pool.query("SELECT u.username FROM users u JOIN users referred ON u.id = referred.referrer_id WHERE referred.id = $1", [userId])
        ]);
        
        // 2. Fetch categorized yields based on standard level payout amounts
        const earningsRes = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN referral_level = 1 THEN amount ELSE 0 END), 0) as l1,
                COALESCE(SUM(CASE WHEN referral_level = 2 THEN amount ELSE 0 END), 0) as l2,
                COALESCE(SUM(CASE WHEN referral_level = 3 THEN amount ELSE 0 END), 0) as l3,
                COALESCE(SUM(amount), 0) as total
            FROM earnings 
            WHERE user_id = $1 AND source_type = 'referral'`, [userId]);

        const team = { l1: [], l2: [], l3: [] };
        let totalNetwork = 0;
        referralsRes.rows.forEach(row => {
            team[`l${row.depth}`].push({
                username: row.username,
                phone: row.phone_number,
                status: row.status
            });
            totalNetwork++;
        });

        res.json({
            referral_count: totalNetwork,
            my_referrer: referrerRes.rows[0]?.username || null,
            l1_count: team.l1.length,
            l2_count: team.l2.length,
            l3_count: team.l3.length,
            team: team,
            referral_earnings: parseFloat(earningsRes.rows[0].total),
            l1_earnings: parseFloat(earningsRes.rows[0].l1),
            l2_earnings: parseFloat(earningsRes.rows[0].l2),
            l3_earnings: parseFloat(earningsRes.rows[0].l3),
            l1_pct: ACTIVATION_FEE > 0 ? Math.round((REFERRAL_L1_AMOUNT / ACTIVATION_FEE) * 100) : 40,
            l2_pct: ACTIVATION_FEE > 0 ? Math.round((REFERRAL_L2_AMOUNT / ACTIVATION_FEE) * 100) : 20,
            l3_pct: ACTIVATION_FEE > 0 ? Math.round((REFERRAL_L3_AMOUNT / ACTIVATION_FEE) * 100) : 10,
            referral_link: `${protocol}://${host}/register.html?ref=${userId}`
        });
    } catch (error) {
        console.error('Referral Stats Error:', error);
        res.status(500).json({ message: 'Failed to synchronize referral matrix.' });
    }
};

// --- Admin: User Approval & Reward Distribution ---
exports.updateUserStatusAdmin = async (req, res) => {
    const { userId, status, payment_status } = req.body;

    try {
        // 1. Get current status to prevent double-payouts
        const userCheck = await pool.query('SELECT status, referrer_id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) return res.status(404).json({ message: "Node not found." });
        
        const oldStatus = userCheck.rows[0].status;

        // 2. Update the user record
        await pool.query(
            'UPDATE users SET status = $1, payment_status = $2 WHERE id = $3',
            [status, payment_status, userId]
        );

        // 3. Trigger Referral Matrix only when status moves to 'Active' for the first time
        if (oldStatus !== 'Active' && status === 'Active') {
            await distributeReferralRewards(userId);
        }

        res.json({ message: "User parameters updated. Referral yields synchronized." });
    } catch (error) {
        console.error('Admin Update Error:', error);
        res.status(500).json({ message: "Internal server error during node update." });
    }
};

// Internal Helper: Recursive Referral Payout Engine
async function distributeReferralRewards(newlyActiveUserId) {
    try {
        // Fetch the referral chain
        const userRes = await pool.query('SELECT referrer_id FROM users WHERE id = $1', [newlyActiveUserId]);
        const l1ReferrerId = userRes.rows[0]?.referrer_id;

        if (!l1ReferrerId) return; // No referral node linked

        // Level 1: Credit the L1 referrer with the configured amount
        await creditReferral(l1ReferrerId, REFERRAL_L1_AMOUNT, newlyActiveUserId, 1);

        // Level 2: Check for L2 referrer and credit with the configured amount
        const l1Res = await pool.query('SELECT referrer_id FROM users WHERE id = $1', [l1ReferrerId]);
        const l2ReferrerId = l1Res.rows[0]?.referrer_id;
        if (l2ReferrerId) {
            await creditReferral(l2ReferrerId, REFERRAL_L2_AMOUNT, newlyActiveUserId, 2);

            // Level 3: Check for L3 referrer and credit with the configured amount
            const l2Res = await pool.query('SELECT referrer_id FROM users WHERE id = $1', [l2ReferrerId]);
            const l3ReferrerId = l2Res.rows[0]?.referrer_id;
            if (l3ReferrerId) {
                await creditReferral(l3ReferrerId, REFERRAL_L3_AMOUNT, newlyActiveUserId, 3);
            }
        }
    } catch (err) {
        console.error('Referral Distribution Failure:', err);
    }
}

async function creditReferral(userId, amount, referredUserId, level) {
    // Get the Referral sector ID
    const sectorRes = await pool.query('SELECT id FROM sectors WHERE name = $1', ['Referrals']);
    const sectorId = sectorRes.rows.length > 0 ? sectorRes.rows[0].id : null;

    await pool.query(
        'INSERT INTO earnings (user_id, sector_id, amount, source_type, referred_user_id, referral_level) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, sectorId, amount, 'referral', referredUserId, level]
    );
}

// --- Blog Management Node ---
exports.submitBlog = async (req, res) => {
    const { title, category, content } = req.body;
    const userId = req.user.id;

    if (userId === 0) {
        return res.status(403).json({ message: "Bypass Admin cannot submit content nodes." });
    }

    if (!title || !category || !content) {
        return res.status(400).json({ message: 'All blog submission fields are required.' });
    }

    try {
        const newBlog = await pool.query(
            'INSERT INTO blogs (user_id, title, category, content, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, title, category, content, 'Pending']
        );

        res.status(201).json({
            message: 'Blog submitted successfully for review. Reward will be allocated upon approval.',
            blog: newBlog.rows[0]
        });
    } catch (error) {
        console.error('Blog Submission Error:', error);
        res.status(500).json({ message: 'Failed to synchronize blog submission.' });
    }
};

exports.getUserBlogs = async (req, res) => {
    const userId = req.user.id;

    try {
        const userBlogs = await pool.query(
            'SELECT id, title, category, status, reward, created_at FROM blogs WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(userBlogs.rows);
    } catch (error) {
        console.error('Get User Blogs Error:', error);
        res.status(500).json({ message: 'Failed to fetch blog submission history.' });
    }
};

// --- Settings & Profile Management Node ---
exports.getSettings = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            'SELECT username, email, phone_number, full_name, bio, status, created_at FROM users WHERE id = $1',
            [userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Node not found." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get Settings Error:', error);
        res.status(500).json({ message: 'Failed to synchronize settings data.' });
    }
};

exports.updateSettings = async (req, res) => {
    const { full_name, phone_number, bio } = req.body;
    const userId = req.user.id;

    try {
        // Phone node validation for Safaricom gateway
        const cleanPhone = phone_number.replace(/[\s\-\(\)]/g, '');
        if (!safaricomRegex.test(cleanPhone)) {
            return res.status(400).json({ message: 'Access Denied: Only Kenyan Safaricom nodes are supported.' });
        }

        await pool.query(
            'UPDATE users SET full_name = $1, phone_number = $2, bio = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
            [full_name, cleanPhone, bio, userId]
        );

        res.json({ message: 'Profile parameters updated successfully.' });
    } catch (error) {
        console.error('Update Settings Error:', error);
        res.status(500).json({ message: 'Failed to update node profile.' });
    }
};

exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        // 1. Fetch current hashed passphrase
        const userRes = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        // 2. Verify current handshake
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Security Alert: Current password incorrect.' });
        }

        // 3. Hash new credentials
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update vault
        await pool.query(
            'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, userId]
        );

        res.json({ message: 'Security credentials rotated successfully.' });
    } catch (error) {
        console.error('Update Password Error:', error);
        res.status(500).json({ message: 'Internal server error during credential rotation.' });
    }
};

exports.getReferrerName = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT username FROM users WHERE id = $1", [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Referrer node not found." });
        res.json({ username: result.rows[0].username });
    } catch (error) {
        console.error('Referrer Resolve Error:', error);
        res.status(500).json({ message: 'Failed to resolve referrer identity.' });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Node not found in ledger." });
        }
        res.json({ message: "User node permanently removed from database." });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ message: "Critical failure during node deletion." });
    }
};