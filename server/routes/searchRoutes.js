const express = require('express');
const articleController = require('../controllers/articleController');
const { authenticate } = require('../middleware/authMiddleware');
const { searchLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// GET /api/search?q=keyword (rate limited — prevents corpus scraping)
router.get('/', authenticate, searchLimiter, articleController.searchArticles);

module.exports = router;
