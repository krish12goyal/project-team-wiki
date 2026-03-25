/**
 * Article Service
 * Business logic layer for articles.
 * Coordinates between MongoDB (metadata), file system (content), and Git (versioning).
 */

const slugify = require('slugify');
const Article = require('../models/Article');
const fileService = require('./fileService');
const gitService = require('./gitService');
const logger = require('../utils/logger');
const User = require('../models/User');

/**
 * Helper: Throw 403 Forbidden Error
 */
function throwForbidden(message = 'Access denied') {
    const err = new Error(message);
    err.statusCode = 403;
    throw err;
}

/**
 * Helper: Check if user has required permission for an article.
 * @param {Object} article - The article mongoose document
 * @param {Object} user - The user object from request (req.user)
 * @param {string} requiredRole - 'viewer', 'editor', or 'owner'
 * @returns {string} The effective permission ('viewer', 'editor', 'owner')
 * @throws {Error} 403 if permission denied
 */
function checkPermission(article, user, requiredRole) {
    if (!user || !user.id) throwForbidden('Authentication required');
    const userId = user.id.toString();

    // 1. Owner always has full access
    if (article.owner && article.owner.toString() === userId) {
        return 'owner';
    }

    // Fallback: Check if user is the author (for legacy articles without owner field)
    if (!article.owner && article.author === user.username) {
        return 'owner';
    }

    // 2. Check shared list
    const shareEntry = article.sharedWith.find(s => s.user.toString() === userId);

    if (!shareEntry) {
        logger.warn(`Unauthorized access attempt blocked: User ${user.username} has no access to article ${article.slug}`);
        throwForbidden('You do not have access to this article.');
    }

    // 3. Compare levels
    const levels = { 'viewer': 1, 'editor': 2, 'owner': 3 };
    const userLevel = levels[shareEntry.permission];
    const requiredLevel = levels[requiredRole];

    if (!userLevel || userLevel < requiredLevel) {
        logger.warn(`Unauthorized edit attempt blocked: User ${user.username} needs ${requiredRole} but has ${shareEntry.permission} for article ${article.slug}`);
        throwForbidden(`Insufficient permissions. Required: ${requiredRole}, Actual: ${shareEntry.permission}`);
    }

    return shareEntry.permission;
}

/**
 * Helper: Safely run autoCommit without blocking/crashing the main flow.
 * @param {string} message
 */
async function safeAutoCommit(message) {
    try {
        await gitService.autoCommit(message);
    } catch (err) {
        logger.error(`GIT DESYNC WARNING: Auto-commit failed for: "${message}"`, {
            error: err.message,
            timestamp: new Date().toISOString(),
            recommendation: 'Manual reconciliation required if using Git for production auditing.'
        });
        // We do not throw here to avoid failing the HTTP request 
        // if the DB/File write was successful.
    }
}

async function createArticle(data, user) {
    if (!user) throwForbidden('User required to create article');

    // Auto-generate slug from title if not provided
    const slug = data.slug || slugify(data.title, { lower: true, strict: true });

    // Save metadata and content to MongoDB
    const article = await Article.create({
        title: data.title,
        slug,
        tags: data.tags || [],
        author: data.author, // Display name
        owner: user.id, // Set owner
        content: data.content || '' // Store content in DB
    });

    // Write content to .md file (Git/Fallback)
    await fileService.writeArticle(slug, data.content || '');

    // Auto-commit to Git
    const authorName = data.author || 'system';
    await safeAutoCommit(`[${authorName}] Created article: ${data.title}`);

    logger.info(`Article created: ${slug} by ${user.username}`);
    return { ...article.toObject(), content: data.content || '' };
}

/**
 * Get all articles visible to the user.
 * @param {Object} user - Requesting user
 * @param {Object} [filters] - Optional { tag }
 * @returns {Promise<Array>}
 */
async function getAllArticles(user, filters = {}) {
    if (!user) return [];

    const query = {
        $or: [
            { owner: user.id },
            { 'sharedWith.user': user.id }
        ]
    };

    if (filters.tag) {
        query.tags = filters.tag;
    }

    // We can also allow public viewing if we had a public flag, 
    // but for now it's strictly permission-based.

    return Article.find(query).sort({ updatedAt: -1 }).lean();
}

/**
 * Get a single article by ID (metadata + content).
 * Enforces 'viewer' permission.
 * @param {string} id - MongoDB ObjectId
 * @param {Object} user - Requesting user
 * @returns {Promise<Object|null>}
 */
async function getArticleById(id, user) {
    const article = await Article.findById(id).lean();
    if (!article) return null;

    // Check permission
    const perm = checkPermission(article, user, 'viewer');

    let content = article.content || '';

    // Fallback to file system if content is empty in DB (for old articles)
    if (!content) {
        try {
            content = await fileService.readArticle(article.slug);
        } catch (err) {
            logger.warn(`Could not read file for slug ${article.slug}: ${err.message}`);
        }
    }

    // Return with effective permission for UI usage
    return { ...article, content, currentPermission: perm };
}

/**
 * Update an existing article.
 * Enforces 'editor' permission.
 * @param {string} id - MongoDB ObjectId
 * @param {Object} data - Fields to update { title?, content?, tags?, author? }
 * @param {Object} user - Requesting user
 * @returns {Promise<Object|null>}
 */
async function updateArticle(id, data, user) {
    const article = await Article.findById(id);
    if (!article) return null;

    // 1. Check permissions BEFORE any modification
    checkPermission(article, user, 'editor');

    const oldSlug = article.slug;

    // 2. Update metadata fields (Protect owner/sharedWith)
    // Explicitly ignore 'owner' and 'sharedWith' from input data
    if (data.title) {
        article.title = data.title;
        // Re-derive slug if title changed
        const newSlug = slugify(data.title, { lower: true, strict: true });
        if (newSlug !== oldSlug) {
            article.slug = newSlug;
            // Rename the .md file
            try {
                await fileService.deleteArticle(oldSlug);
            } catch {
                // old file may not exist
            }
        }
    }
    if (data.tags !== undefined) article.tags = data.tags;

    // 3. Save to MongoDB (Metadata + Content)
    if (data.content !== undefined) article.content = data.content;
    await article.save();

    // 4. Write updated content to file system (Git/Fallback)
    if (data.content !== undefined) {
        await fileService.writeArticle(article.slug, data.content);
    }

    // 5. Auto-commit with ACTUAL user attribution
    // This happens LAST. If it fails, we log and retry/ignore, but DB/File are already updated.
    const authorName = user.username || 'anonymous';
    await safeAutoCommit(`[${authorName}] Updated article: ${article.title}`);

    logger.info(`Article updated: ${article.slug} by ${user.username}`);
    return { ...article.toObject(), content: data.content };
}

/**
 * Delete an article.
 * Enforces 'owner' permission.
 * @param {string} id - MongoDB ObjectId
 * @param {Object} user - Requesting user
 * @returns {Promise<Object|null>}
 */
async function deleteArticle(id, user) {
    // Fetch first to check permission
    const article = await Article.findById(id);
    if (!article) return null;

    checkPermission(article, user, 'owner');

    await Article.deleteOne({ _id: id });

    // Remove the .md file
    try {
        await fileService.deleteArticle(article.slug);
    } catch (err) {
        logger.warn(`Could not delete file for slug ${article.slug}: ${err.message}`);
    }

    // Auto-commit
    await safeAutoCommit(`[system] Deleted article: ${article.title} (Triggered by ${user.username})`);

    logger.info(`Article deleted: ${article.slug} by ${user.username}`);
    return article;
}

/**
 * Full-text search using MongoDB text index.
 * Only returns articles user has access to.
 * @param {string} query - Search query string
 * @param {Object} user - Requesting user
 * @returns {Promise<Array>}
 */
async function searchArticles(query, user) {
    if (!user) return [];

    const baseQuery = {
        $and: [
            {
                $or: [
                    { owner: user.id },
                    { 'sharedWith.user': user.id }
                ]
            }
        ]
    };

    if (!query || !query.trim()) {
        return getAllArticles(user); // Reuse getAllArticles which has similar logic or just return proper list
    }

    // Combine access check with text search
    const searchQuery = {
        ...baseQuery,
        $text: { $search: query }
    };

    return Article.find(
        searchQuery,
        { score: { $meta: 'textScore' } }
    )
        .sort({ score: { $meta: 'textScore' } })
        .lean();
}

/**
 * Get version history (git log) for an article.
 * Enforces 'viewer' permission.
 * @param {string} id - MongoDB ObjectId
 * @param {Object} user - Requesting user
 * @returns {Promise<Array>} Commit history
 */
async function getArticleHistory(id, user) {
    const article = await Article.findById(id).lean();
    if (!article) return null;

    checkPermission(article, user, 'viewer');

    const filePath = `articles/${article.slug}.md`;
    return gitService.gitLog(filePath);
}

/**
 * Restore an article to a previous Git commit.
 * Enforces 'editor' permission.
 * @param {string} id - MongoDB ObjectId
 * @param {string} commitHash - Target commit hash
 * @param {Object} user - Requesting user
 * @returns {Promise<Object|null>}
 */
async function restoreArticle(id, commitHash, user) {
    const article = await Article.findById(id).lean();
    if (!article) return null;

    checkPermission(article, user, 'editor');

    const filePath = `articles/${article.slug}.md`;

    // Restore the file content from the specified commit
    try {
        await gitService.gitRestore(commitHash, filePath);
    } catch (err) {
        logger.error(`Git restore failed: ${err.message}`);
        throw err; // Propagate error for restore as it's the main action
    }

    // Read the restored content
    const content = await fileService.readArticle(article.slug);

    // Save restored content to DB
    await Article.updateOne({ _id: article._id }, { $set: { content } });

    // Auto-commit the restoration cleanly without overriding history
    await safeAutoCommit(`[${user.username}] Restored article: ${article.title}`);

    logger.info(`Article restored: ${article.slug} to ${commitHash.substring(0, 7)} by ${user.username}`);
    return { ...article, content };
}

/**
 * Share article with a user.
 * Only owner can share.
 */
async function shareArticle(articleId, targetUsername, permission, currentUser) {
    const article = await Article.findById(articleId);
    if (!article) return null;

    checkPermission(article, currentUser, 'owner');

    const targetUser = await User.findOne({ username: targetUsername });
    if (!targetUser) {
        const err = new Error(`User '${targetUsername}' not found`);
        err.statusCode = 404;
        throw err;
    }

    if (targetUser._id.equals(article.owner)) {
        throw new Error('Cannot share article with yourself (you are the owner)');
    }

    // Check if already shared
    const existingIndex = article.sharedWith.findIndex(s => s.user.equals(targetUser._id));
    if (existingIndex >= 0) {
        // Update permission
        article.sharedWith[existingIndex].permission = permission;
        article.sharedWith[existingIndex].addedAt = new Date();
    } else {
        // Add new share
        article.sharedWith.push({
            user: targetUser._id,
            permission,
            addedAt: new Date()
        });
    }

    await article.save();
    logger.info(`User ${currentUser.username} shared article ${article.slug} with ${targetUsername} (${permission})`);

    // Return updated list with populated usernames for UI
    await article.populate('sharedWith.user', 'username');
    return article.sharedWith;
}

/**
 * Remove access for a user.
 * Only owner can remove.
 */
async function removeAccess(articleId, targetUserId, currentUser) {
    const article = await Article.findById(articleId);
    if (!article) return null;

    checkPermission(article, currentUser, 'owner');

    if (article.owner.equals(targetUserId)) {
        throw new Error('Cannot remove owner from article');
    }

    const initialLength = article.sharedWith.length;
    article.sharedWith = article.sharedWith.filter(s => !s.user.equals(targetUserId));

    if (article.sharedWith.length === initialLength) {
        // User was not found in list, but operation is idempotent/successful
        return article.sharedWith;
    }

    await article.save();
    logger.info(`User ${currentUser.username} removed access for ${targetUserId} on article ${article.slug}`);

    await article.populate('sharedWith.user', 'username');
    return article.sharedWith;
}

module.exports = {
    createArticle,
    getAllArticles,
    getArticleById,
    updateArticle,
    deleteArticle,
    searchArticles,
    getArticleHistory,
    restoreArticle,
    shareArticle,
    removeAccess
};
