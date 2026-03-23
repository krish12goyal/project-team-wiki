/**
 * Article Routes
 * Mounts all article-related endpoints with authentication and validation.
 */

const express = require('express');
const { body } = require('express-validator');
const articleController = require('../controllers/articleController');
const { authenticate } = require('../middleware/authMiddleware');

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

// GET /api/search — Search articles
router.get('/search', authenticate, articleController.searchArticles);

// --- Protected routes (require authentication + permission handled in service) ---

// POST /api/articles — Create article
router.post('/', authenticate, articleValidation, articleController.createArticle);

// PUT /api/articles/:id — Update article
router.put('/:id', authenticate, updateValidation, articleController.updateArticle);

// DELETE /api/articles/:id — Delete article
router.delete('/:id', authenticate, articleController.deleteArticle);

// POST /api/articles/:id/restore — Restore version
router.post('/:id/restore', authenticate, articleController.restoreVersion);

// POST /api/articles/:id/share — Share article (Owner only - checked in service)
router.post('/:id/share', authenticate, articleController.shareArticle);

// DELETE /api/articles/:id/share/:userId — Remove access (Owner only)
router.delete('/:id/share/:userId', authenticate, articleController.removeAccess);

module.exports = router;
