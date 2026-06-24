/**
 * Invitation Controller
 * Handles the full invitation lifecycle:
 *   create → pending → accept (grants access) / decline / cancel
 */

const Invitation = require('../models/Invitation');
const Article = require('../models/Article');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * POST /api/invitations
 * Article owner sends an invitation to a user.
 * Body: { articleId, usernameOrEmail, permission }
 */
async function createInvitation(req, res, next) {
    try {
        const { articleId, usernameOrEmail, permission } = req.body;

        if (!articleId || !usernameOrEmail || !['viewer', 'editor'].includes(permission)) {
            return res.status(400).json({ error: 'articleId, usernameOrEmail, and permission (viewer/editor) are required.' });
        }

        // Verify the article exists and requesting user is the owner
        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: 'Article not found.' });

        if (!article.owner.equals(req.user.id)) {
            return res.status(403).json({ error: 'Only the article owner can send invitations.' });
        }

        // Find the target user by username or email
        const targetUser = await User.findOne({
            $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
        });
        if (!targetUser) {
            return res.status(404).json({ error: `User '${usernameOrEmail}' not found.` });
        }

        // Cannot invite yourself
        if (targetUser._id.equals(req.user.id)) {
            return res.status(400).json({ error: 'You cannot invite yourself.' });
        }

        // Check if this user already has direct access
        const alreadyShared = article.sharedWith.some(s => s.user.equals(targetUser._id));
        if (alreadyShared) {
            return res.status(409).json({ error: `${targetUser.username} already has access to this article.` });
        }

        // Check for an existing pending invitation
        const existing = await Invitation.findOne({
            article: articleId,
            toUser: targetUser._id,
            status: 'pending',
        });
        if (existing) {
            return res.status(409).json({ error: `A pending invitation already exists for ${targetUser.username}.` });
        }

        const invitation = await Invitation.create({
            article: articleId,
            fromUser: req.user.id,
            toUser: targetUser._id,
            permission,
        });

        const populated = await invitation.populate([
            { path: 'fromUser', select: 'username' },
            { path: 'toUser', select: 'username' },
            { path: 'article', select: 'title slug' },
        ]);

        logger.info(`Invitation sent: ${req.user.username} → ${targetUser.username} for article ${article.slug}`);
        res.status(201).json(populated);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/invitations
 * Returns all PENDING invitations addressed to the logged-in user.
 */
async function getMyInvitations(req, res, next) {
    try {
        const invitations = await Invitation.find({
            toUser: req.user.id,
            status: 'pending',
        })
            .populate('fromUser', 'username')
            .populate('article', 'title slug _id')
            .sort({ createdAt: -1 });

        res.json(invitations);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/invitations/article/:articleId
 * Returns all pending invitations for a specific article (owner only).
 */
async function getArticleInvitations(req, res, next) {
    try {
        const article = await Article.findById(req.params.articleId);
        if (!article) return res.status(404).json({ error: 'Article not found.' });

        if (!article.owner.equals(req.user.id)) {
            return res.status(403).json({ error: 'Only the owner can view article invitations.' });
        }

        const invitations = await Invitation.find({
            article: req.params.articleId,
            status: 'pending',
        })
            .populate('toUser', 'username')
            .sort({ createdAt: -1 });

        res.json(invitations);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/invitations/:id/accept
 * Invited user accepts → access is granted in the article's sharedWith array.
 */
async function acceptInvitation(req, res, next) {
    try {
        const invitation = await Invitation.findById(req.params.id).populate('article');
        if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

        // Only the recipient can accept
        if (!invitation.toUser.equals(req.user.id)) {
            return res.status(403).json({ error: 'This invitation is not for you.' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Invitation is already ${invitation.status}.` });
        }

        // Grant access in the Article model
        const article = await Article.findById(invitation.article._id);
        if (!article) return res.status(404).json({ error: 'Article no longer exists.' });

        // Avoid duplicates — update if already present, add if not
        const existingIdx = article.sharedWith.findIndex(s => s.user.equals(req.user.id));
        if (existingIdx >= 0) {
            article.sharedWith[existingIdx].permission = invitation.permission;
        } else {
            article.sharedWith.push({ user: req.user.id, permission: invitation.permission });
        }
        await article.save();

        // Mark invitation as accepted
        invitation.status = 'accepted';
        await invitation.save();

        logger.info(`Invitation accepted: ${req.user.username} accepted access to ${article.slug}`);
        res.json({ message: 'Invitation accepted. You now have access to the article.', invitation });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/invitations/:id/decline
 * Invited user declines the invitation.
 */
async function declineInvitation(req, res, next) {
    try {
        const invitation = await Invitation.findById(req.params.id);
        if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

        if (!invitation.toUser.equals(req.user.id)) {
            return res.status(403).json({ error: 'This invitation is not for you.' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Invitation is already ${invitation.status}.` });
        }

        invitation.status = 'declined';
        await invitation.save();

        logger.info(`Invitation declined: ${req.user.username} declined article ${invitation.article}`);
        res.json({ message: 'Invitation declined.', invitation });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/invitations/:id
 * Article owner cancels a pending invitation.
 */
async function cancelInvitation(req, res, next) {
    try {
        const invitation = await Invitation.findById(req.params.id).populate('article', 'owner slug');
        if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

        // Only the article owner (sender) can cancel
        if (!invitation.fromUser.equals(req.user.id)) {
            return res.status(403).json({ error: 'Only the invitation sender can cancel it.' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Cannot cancel an invitation that is already ${invitation.status}.` });
        }

        await Invitation.deleteOne({ _id: invitation._id });

        logger.info(`Invitation cancelled by ${req.user.username} for article ${invitation.article?.slug}`);
        res.json({ message: 'Invitation cancelled.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    createInvitation,
    getMyInvitations,
    getArticleInvitations,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,
};
