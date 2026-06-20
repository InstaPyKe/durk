const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const adminController = require('../controllers/adminController');
const { authMiddleware } = require('../middleware/authMiddleware'); // Destructure the function
const adminAuth = require('../middleware/adminAuth');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/admin-login', userController.adminLogin);
router.get('/public/referrer/:id', userController.getReferrerName);
router.get('/check-username/:username', userController.checkUsername);

// Administrative Control Routes
router.get('/admin/stats', authMiddleware, adminAuth, adminController.getDashboardStats); // This is the endpoint for the dashboard
router.get('/admin/users', authMiddleware, adminAuth, adminController.getAllUsers);
router.get('/admin/payouts/pending', authMiddleware, adminAuth, adminController.getPendingPayouts);
router.get('/admin/transactions', authMiddleware, adminAuth, adminController.getAllTransactions);
router.post('/admin/users/login-as/:id', authMiddleware, adminAuth, adminController.loginAsUser);
router.post('/admin/users/adjust-balance/:id', authMiddleware, adminAuth, adminController.adjustUserBalance);
router.post('/admin/users/approve-all', authMiddleware, adminAuth, adminController.bulkApproveUsers);
router.get('/admin/referrals', authMiddleware, adminAuth, adminController.getAllReferrals);
router.get('/admin/activities', authMiddleware, adminAuth, adminController.getRecentActivities);
router.get('/admin/blogs', authMiddleware, adminAuth, adminController.getBlogSubmissions);
router.patch('/admin/blogs/:id', authMiddleware, adminAuth, adminController.processBlogApproval);
router.get('/admin/tasks/survey-completions', authMiddleware, adminAuth, adminController.getSurveyCompletions);
router.patch('/admin/tasks/survey-approvals/:id', authMiddleware, adminAuth, adminController.processSurveyApproval);
router.post('/admin/tasks/verify-link', authMiddleware, adminAuth, adminController.verifyVideoLink);
router.get('/admin/system-status', authMiddleware, adminAuth, adminController.getSystemStatus);
router.post('/admin/kill-switch', authMiddleware, adminAuth, adminController.toggleKillSwitch);
router.patch('/admin/payouts/:payoutId', authMiddleware, adminAuth, adminController.updatePayoutStatus);
router.patch('/admin/users/:id', authMiddleware, adminAuth, adminController.updateUserStatus);
router.delete('/admin/users/:id', authMiddleware, adminAuth, userController.deleteUser);

// Task Control Center
router.get('/admin/tasks', authMiddleware, adminAuth, adminController.getAllTasks);
router.post('/admin/tasks', authMiddleware, adminAuth, adminController.addTask);
router.patch('/admin/tasks/:taskId', authMiddleware, adminAuth, adminController.updateTask);
router.delete('/admin/tasks/:taskId', authMiddleware, adminAuth, adminController.deleteTask);

// Protected routes (require authentication)
router.get('/dashboard', authMiddleware, userController.getDashboardStats);
router.get('/tasks/type/:type', authMiddleware, userController.getTasksByType);
router.post('/tasks/start', authMiddleware, userController.startTaskSequence);
router.post('/transactions/payout', authMiddleware, userController.claimPayout);
router.get('/wallet', authMiddleware, userController.getWalletData);
router.post('/withdraw', authMiddleware, userController.requestWithdrawal);
router.get('/referral-stats', authMiddleware, userController.getReferralStats);
router.post('/blogs', authMiddleware, userController.submitBlog);
router.get('/blogs', authMiddleware, userController.getUserBlogs);
router.get('/settings', authMiddleware, userController.getSettings);
router.put('/settings', authMiddleware, userController.updateSettings);
router.patch('/settings/password', authMiddleware, userController.updatePassword);

module.exports = router;