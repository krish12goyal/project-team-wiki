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

/**
 * Create a new article.
 * @param {Object} data - { title, content, tags, author, slug? }
 * @returns {Promise<Object>} Created article with content
 */
async function createArticle(data) {
    // Auto-generate slug from title if not provided
    const slug = data.slug || slugify(data.title, { lower: true, strict: true });

    // Save metadata to MongoDB
    const article = await Article.create({
        title: data.title,
        slug,
        tags: data.tags || [],
        author: data.author,
    });

    // Write content to .md file
    await fileService.writeArticle(slug, data.content || '');

    // Auto-commit to Git
    gitService.autoCommit(`Article created: ${data.title}`);

    logger.info(`Article created: ${slug}`);
    return { ...article.toObject(), content: data.content || '' };
}

/**
 * Get all articles (metadata only, sorted by most recent).
 * @param {Object} [filters] - Optional { tag }
 * @returns {Promise<Array>}
 */
async function getAllArticles(filters = {}) {
    const query = {};
    if (filters.tag) {
        query.tags = filters.tag;
    }
    return Article.find(query).sort({ updatedAt: -1 }).lean();
}

/**
 * Get a single article by ID (metadata + content).
 * @param {string} id - MongoDB ObjectId
 * @returns {Promise<Object|null>}
 */
async function getArticleById(id) {
    const article = await Article.findById(id).lean();
    if (!article) return null;

    let content = '';
    try {
        content = await fileService.readArticle(article.slug);
    } catch (err) {
        logger.warn(`Could not read file for slug ${article.slug}: ${err.message}`);
    }

    return { ...article, content };
}

/**
 * Update an existing article.
 * @param {string} id - MongoDB ObjectId
 * @param {Object} data - Fields to update { title?, content?, tags? }
 * @returns {Promise<Object|null>}
 */
async function updateArticle(id, data) {
    const article = await Article.findById(id);
    if (!article) return null;

    const oldSlug = article.slug;

    // Update metadata fields
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

    await article.save();

    // Write updated content
    if (data.content !== undefined) {
        await fileService.writeArticle(article.slug, data.content);
    }

    // Auto-commit
    gitService.autoCommit(`Article updated: ${article.title}`);

    logger.info(`Article updated: ${article.slug}`);
    return { ...article.toObject(), content: data.content };
}

/**
 * Delete an article.
 * @param {string} id - MongoDB ObjectId
 * @returns {Promise<Object|null>}
 */
async function deleteArticle(id) {
    const article = await Article.findByIdAndDelete(id);
    if (!article) return null;

    // Remove the .md file
    try {
        await fileService.deleteArticle(article.slug);
    } catch (err) {
        logger.warn(`Could not delete file for slug ${article.slug}: ${err.message}`);
    }

    // Auto-commit
    gitService.autoCommit(`Article deleted: ${article.title}`);

    logger.info(`Article deleted: ${article.slug}`);
    return article;
}

/**
 * Full-text search using MongoDB text index.
 * @param {string} query - Search query string
 * @returns {Promise<Array>}
 */
async function searchArticles(query) {
    if (!query || !query.trim()) {
        return getAllArticles();
    }
    return Article.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
    )
        .sort({ score: { $meta: 'textScore' } })
        .lean();
}

/**
 * Get version history (git log) for an article.
 * @param {string} id - MongoDB ObjectId
 * @returns {Promise<Array>} Commit history
 */
async function getArticleHistory(id) {
    const article = await Article.findById(id).lean();
    if (!article) return null;

    const filePath = `articles/${article.slug}.md`;
    return gitService.gitLog(filePath);
}

/**
 * Restore an article to a previous Git commit.
 * @param {string} id - MongoDB ObjectId
 * @param {string} commitHash - Target commit hash
 * @returns {Promise<Object|null>}
 */
async function restoreArticle(id, commitHash) {
    const article = await Article.findById(id).lean();
    if (!article) return null;

    const filePath = `articles/${article.slug}.md`;

    // Restore the file content from the specified commit
    gitService.gitRestore(commitHash, filePath);

    // Read the restored content
    const content = await fileService.readArticle(article.slug);

    // Auto-commit the restoration
    gitService.autoCommit(`Article restored: ${article.title} to commit ${commitHash.substring(0, 7)}`);

    logger.info(`Article restored: ${article.slug} to ${commitHash.substring(0, 7)}`);
    return { ...article, content };
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
};
