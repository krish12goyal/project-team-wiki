/**
 * Restore Request Routes
 * Mounts endpoints for editor restore requests (create, retrieve, approve, decline).
 */

const express = require('express');
const restoreRequestController = require('../controllers/restoreRequestController');
const { authenticate } = require('../middleware/authMiddleware');
const { restoreRequestLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// POST /api/restore-requests — Editor submits a restore request (rate limited — prevents flooding owner)
router.post('/', authenticate, restoreRequestLimiter, restoreRequestController.createRequest);

// GET /api/restore-requests — Owner retrieves pending restore requests for their articles
router.get('/', authenticate, restoreRequestController.getMyPendingRequests);

// PUT /api/restore-requests/:id/approve — Owner approves and executes a restore
router.put('/:id/approve', authenticate, restoreRequestController.approveRequest);

// PUT /api/restore-requests/:id/decline — Owner declines a restore request
router.put('/:id/decline', authenticate, restoreRequestController.declineRequest);

module.exports = router;
