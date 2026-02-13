/**
 * Search Routes
 * Dedicated route for full-text article search.
 */

const express = require('express');
const articleController = require('../controllers/articleController');

const router = express.Router();

// GET /api/search?q=keyword
router.get('/', articleController.searchArticles);

module.exports = router;
