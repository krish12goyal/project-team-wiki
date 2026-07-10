/**
 * Article Routes
 * Mounts all article-related endpoints with authentication and validation.
 */

const express = require('express');
const { body } = require('express-validator');
const articleController = require('../controllers/articleController');
const { authenticate } = require('../middleware/authMiddleware');
const { articleWriteLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// --- Validation rules ---

const articleValidation = [
    body('title').notEmpty().withMessage('Title is required').trim(),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
];

const updateValidation = [
    body('title').optional().notEmpty().withMessage('Title cannot be empty').trim(),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
];

// --- Public routes (read-only) ---

// GET /api/articles — List all articles
router.get('/', authenticate, articleController.getAllArticles);

// GET /api/articles/:id — Get single article
router.get('/:id', authenticate, articleController.getArticle);

// GET /api/articles/:id/history — Version history
router.get('/:id/history', authenticate, articleController.getHistory);

// --- Protected routes (require authentication + permission handled in service) ---

// POST /api/articles — Create article (rate limited — prevents bulk article spam)
router.post('/', authenticate, articleWriteLimiter, articleValidation, articleController.createArticle);

// PUT /api/articles/:id — Update article (rate limited — prevents rapid automated edits)
router.put('/:id', authenticate, articleWriteLimiter, updateValidation, articleController.updateArticle);

// DELETE /api/articles/:id — Delete article (rate limited — prevents bulk deletion)
router.delete('/:id', authenticate, articleWriteLimiter, articleController.deleteArticle);

// POST /api/articles/:id/restore — Restore version (rate limited — prevents restore spam)
router.post('/:id/restore', authenticate, articleWriteLimiter, articleController.restoreVersion);

// POST /api/articles/:id/share — Share article (Owner only - checked in service)
router.post('/:id/share', authenticate, articleWriteLimiter, articleController.shareArticle);

// DELETE /api/articles/:id/share/:userId — Remove access (Owner only)
router.delete('/:id/share/:userId', authenticate, articleWriteLimiter, articleController.removeAccess);

module.exports = router;

