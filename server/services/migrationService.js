/**
 * Migration Service
 * Handles one-time database migrations.
 */
const User = require('../models/User');
const Article = require('../models/Article');
const logger = require('../utils/logger');

async function migrateArticleOwners() {
    logger.info('Starting article owner migration...');

    // 1. Find or create a system admin user for orphans
    let systemUser = await User.findOne({ username: 'system_admin' });
    if (!systemUser) {
        systemUser = await User.create({
            username: 'system_admin',
            password: 'complex_password_placeholder_' + Date.now(), // Random password, no one logs in
            role: 'editor'
        });
        logger.info('Created system_admin user for orphaned articles.');
    }

    const articles = await Article.find({ owner: { $exists: false } });
    let migratedCount = 0;
    let orphanedCount = 0;

    for (const article of articles) {
        // Try to find user by author string
        const authorUser = await User.findOne({ username: article.author });

        if (authorUser) {
            article.owner = authorUser._id;
            migratedCount++;
        } else {
            // Assign to system admin
            article.owner = systemUser._id;
            logger.warn(`Orphaned article found: "${article.title}" (Author: ${article.author}). Assigned to system_admin.`);
            orphanedCount++;
        }
        await article.save();
    }

    if (migratedCount > 0 || orphanedCount > 0) {
        logger.info(`Migration complete: ${migratedCount} migrated, ${orphanedCount} orphaned/assigned to system.`);
    } else {
        logger.info('No articles needed migration.');
    }
}

module.exports = { migrateArticleOwners };
