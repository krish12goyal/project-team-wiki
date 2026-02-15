/**
 * Server Entry Point
 * Initialises Express, connects to MongoDB, mounts routes, and starts listening.
 */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const logger = require('./server/utils/logger');
// Corrected middleware import paths
const errorHandler = require('./server/middleware/errorHandler');
const articleRoutes = require('./server/routes/articleRoutes');
const authRoutes = require('./server/routes/authRoutes');
const searchRoutes = require('./server/routes/searchRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate essential environment variables
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    logger.error('Missing required environment variables (MONGODB_URI, JWT_SECRET). Exiting.');
    process.exit(1);
}

// --------------- Middleware ---------------

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
});

// --------------- Static Files ---------------

// Serve the frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// --------------- API Routes ---------------

app.use('/api/articles', articleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);

// --------------- SPA-style HTML routes ---------------

// Serve specific HTML pages for frontend navigation
const publicDir = path.join(__dirname, 'public');
const htmlPages = ['editor', 'article', 'history'];
htmlPages.forEach((page) => {
    app.get(`/${page}`, (_req, res) => {
        res.sendFile(path.join(publicDir, `${page}.html`));
    });
    app.get(`/${page}.html`, (_req, res) => {
        res.sendFile(path.join(publicDir, `${page}.html`));
    });
});

// --------------- Error Handler ---------------

app.use(errorHandler);

// --------------- Start Server ---------------

async function start() {
    try {
        // Ensure articles directory exists
        const articlesDir = path.join(__dirname, 'articles');
        if (!fs.existsSync(articlesDir)) {
            fs.mkdirSync(articlesDir, { recursive: true });
            logger.info('Created articles/ directory');
        }

        // Ensure logs directory exists
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB');

        // Run migrations
        const { migrateArticleOwners } = require('./server/services/migrationService');
        migrateArticleOwners().catch(err => logger.error('Migration failed:', err));

        // Start listening
        app.listen(PORT, () => {
            // Ensure text indexes are created on startup
            const Article = require('./server/models/Article');
            Article.ensureIndexes().then(() => {
                logger.info('MongoDB indexes ensured');
            }).catch(err => {
                logger.error('Failed to ensure MongoDB indexes:', err);
            });
            logger.info(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        logger.error(`Failed to start server: ${err.message}`);
        process.exit(1);
    }
}

start();
