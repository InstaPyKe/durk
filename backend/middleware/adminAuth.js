const adminAuth = (req, res, next) => {
    // This assumes req.user is populated by your primary authMiddleware
    if (req.user && req.user.is_admin) {
        next();
    } else {
        console.warn(`[SECURITY] Unauthorized Admin Access Attempt by UID: ${req.user ? req.user.id : 'Anonymous'}`);
        res.status(403).json({ 
            message: 'Access Denied: You do not have the required administrative clearance.' 
        });
    }
};

module.exports = adminAuth;