/**
 * Search Routes
 * Dedicated route for full-text article search.
 */

const express = require('express');
const articleController = require('../controllers/articleController');

const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/search?q=keyword
router.get('/', authenticate, articleController.searchArticles);

module.exports = router;
