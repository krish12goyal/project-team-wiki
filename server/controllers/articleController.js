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
        const author = req.user ? req.user.username : 'anonymous';

        const article = await articleService.createArticle({ title, content, tags, author, slug });
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

        const articles = await articleService.getAllArticles(filters);
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
        const article = await articleService.getArticleById(req.params.id);
        if (!article) return res.status(404).json({ error: 'Article not found' });
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
        const article = await articleService.updateArticle(req.params.id, { title, content, tags });
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
        const article = await articleService.deleteArticle(req.params.id);
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
        const articles = await articleService.searchArticles(req.query.q);
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
        const history = await articleService.getArticleHistory(req.params.id);
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

        const article = await articleService.restoreArticle(req.params.id, commitHash);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json({ message: 'Article restored', article });
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
};
