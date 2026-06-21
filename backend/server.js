const express = require('express');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Correct order: Serve specific static directories first
// Admin static files should be served before public static files
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/user', express.static(path.join(__dirname, '../user')));
app.use(express.static(path.join(__dirname, '../public'))); // General public files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Mount API Routes
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);

// Admin-specific 404 handler (must come before the general public fallback)
// If a request starts with /admin but isn't found by the static middleware,
// serve the admin 404 page.
// This needs to be placed after the static admin files are served, but before the general catch-all
app.get('/admin/*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../admin/404.html')); // Serve the admin 404 page
});

// Fallback to serve index.html for any non-API routes
app.get('*', (req, res) => {
    // This catch-all should only apply if the path is NOT an API route AND NOT an admin route
    if (!req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        res.status(404).json({ error: 'Not Found' });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SYSTEM] Master node initialized on port ${PORT}`);
});