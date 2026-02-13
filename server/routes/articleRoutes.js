/**
 * Article Routes
 * Mounts all article-related endpoints with authentication and validation.
 */

const express = require('express');
const { body } = require('express-validator');
const articleController = require('../controllers/articleController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

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
router.get('/', articleController.getAllArticles);

// GET /api/articles/:id — Get single article
router.get('/:id', articleController.getArticle);

// GET /api/articles/:id/history — Version history
router.get('/:id/history', articleController.getHistory);

// --- Protected routes (require authentication + editor role) ---

// POST /api/articles — Create article
router.post('/', authenticate, authorize('editor'), articleValidation, articleController.createArticle);

// PUT /api/articles/:id — Update article
router.put('/:id', authenticate, authorize('editor'), updateValidation, articleController.updateArticle);

// DELETE /api/articles/:id — Delete article
router.delete('/:id', authenticate, authorize('editor'), articleController.deleteArticle);

// POST /api/articles/:id/restore — Restore version
router.post('/:id/restore', authenticate, authorize('editor'), articleController.restoreVersion);

module.exports = router;
