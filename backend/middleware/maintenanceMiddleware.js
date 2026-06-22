const pool = require('../config/db');

module.exports = async (req, res, next) => {
    const path = req.path;

    // 1. ALWAYS allow admin paths (page requests and api actions)
    if (path.startsWith('/admin') || 
        path.startsWith('/api/users/admin') || 
        path === '/api/users/admin-login') {
        return next();
    }

    // Allow the maintenance page itself to load
    if (path === '/maintenance.html') {
        return next();
    }

    // Determine request type
    const isHtmlRequest = (req.headers.accept && req.headers.accept.includes('text/html')) || 
                          path.endsWith('.html') || 
                          path === '/' || 
                          path === '/index.html';
    const isApiRequest = path.startsWith('/api');

    // 2. Allow other non-HTML static resources (images, JS, CSS, fonts) to pass through
    if (!isHtmlRequest && !isApiRequest) {
        return next();
    }

    try {
        const result = await pool.query("SELECT value FROM system_config WHERE key = 'maintenance_mode'");
        const isMaintenance = result.rows.length > 0 ? result.rows[0].value === 'true' : false;

        if (isMaintenance) {
            if (isHtmlRequest) {
                return res.redirect('/maintenance.html');
            } else if (isApiRequest) {
                return res.status(503).json({
                    error: 'MaintenanceMode',
                    message: 'System is currently undergoing scheduled maintenance. Please check back shortly.'
                });
            }
        }
    } catch (error) {
        console.error('[SECURITY] Maintenance mode verification fault:', error);
    }

    next();
};
