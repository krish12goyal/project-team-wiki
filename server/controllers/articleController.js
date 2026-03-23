/**
 * Article Controller
 * Route handlers for article CRUD, search, history, and restore.
 * Delegates business logic to articleService.
 */

const { validationResult } = require('express-validator');
const articleService = require('../services/articleService');

/**
 * POST /api/articles — Create a new article
 */
async function createArticle(req, res, next) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { title, content, tags, slug } = req.body;
        // User is guaranteed by auth middleware
        const article = await articleService.createArticle({ title, content, tags, slug, author: req.user.username }, req.user);
        res.status(201).json(article);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/articles — List all articles (optional ?tag= filter)
 */
async function getAllArticles(req, res, next) {
    try {
        const filters = {};
        if (req.query.tag) filters.tag = req.query.tag;

        // Pass req.user to filter visible articles
        const articles = await articleService.getAllArticles(req.user, filters);
        res.json(articles);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/articles/:id — Get single article with content
 */
async function getArticle(req, res, next) {
    try {
        // Pass req.user for permission check
        const article = await articleService.getArticleById(req.params.id, req.user);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json(article);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/articles/:id — Update an article
 */
async function updateArticle(req, res, next) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { title, content, tags } = req.body;
        // Pass req.user for permission check & attribution
        const article = await articleService.updateArticle(req.params.id, { title, content, tags }, req.user);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/articles/:id — Delete an article
 */
async function deleteArticle(req, res, next) {
    try {
        const article = await articleService.deleteArticle(req.params.id, req.user);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json({ message: 'Article deleted', article });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/search?q= — Full-text search
 */
async function searchArticles(req, res, next) {
    try {
        const articles = await articleService.searchArticles(req.query.q, req.user);
        res.json(articles);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/articles/:id/history — Git version history
 */
async function getHistory(req, res, next) {
    try {
        const history = await articleService.getArticleHistory(req.params.id, req.user);
        if (history === null) return res.status(404).json({ error: 'Article not found' });
        res.json(history);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/articles/:id/restore — Restore to a specific commit
 */
async function restoreVersion(req, res, next) {
    try {
        const { commitHash } = req.body;
        if (!commitHash) return res.status(400).json({ error: 'commitHash is required' });

        const article = await articleService.restoreArticle(req.params.id, commitHash, req.user);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json({ message: 'Article restored', article });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/articles/:id/share — Share article
 */
async function shareArticle(req, res, next) {
    try {
        const { usernameOrEmail, permission } = req.body;
        // Basic validation
        if (!usernameOrEmail || !['viewer', 'editor'].includes(permission)) {
            return res.status(400).json({ error: 'Valid username and permission (viewer/editor) required' });
        }

        const updatedList = await articleService.shareArticle(req.params.id, usernameOrEmail, permission, req.user);
        if (!updatedList) return res.status(404).json({ error: 'Article not found' });

        res.json({ message: 'Article shared successfully', sharedWith: updatedList });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/articles/:id/share/:userId — Remove access
 */
async function removeAccess(req, res, next) {
    try {
        const updatedList = await articleService.removeAccess(req.params.id, req.params.userId, req.user);
        if (!updatedList) return res.status(404).json({ error: 'Article not found' });

        res.json({ message: 'Access removed successfully', sharedWith: updatedList });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    createArticle,
    getAllArticles,
    getArticle,
    updateArticle,
    deleteArticle,
    searchArticles,
    getHistory,
    restoreVersion,
    shareArticle,
    removeAccess
};
