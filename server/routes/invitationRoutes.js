/**
 * Invitation Routes
 * All invitation lifecycle endpoints — create, list, accept, decline, cancel.
 */

const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const invitationController = require('../controllers/invitationController');
const { invitationLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// POST   /api/invitations  — Send an invitation (rate limited — prevents bulk-invite spam)
router.post('/', authenticate, invitationLimiter, invitationController.createInvitation);

// GET    /api/invitations                          — Get pending invitations for me
router.get('/', authenticate, invitationController.getMyInvitations);

// GET    /api/invitations/article/:articleId       — Get all invitations for an article (owner)
router.get('/article/:articleId', authenticate, invitationController.getArticleInvitations);

// PUT    /api/invitations/:id/accept               — Accept an invitation
router.put('/:id/accept', authenticate, invitationController.acceptInvitation);

// PUT    /api/invitations/:id/decline              — Decline an invitation
router.put('/:id/decline', authenticate, invitationController.declineInvitation);

// DELETE /api/invitations/:id                      — Owner cancels a pending invite
router.delete('/:id', authenticate, invitationController.cancelInvitation);

module.exports = router;
