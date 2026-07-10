/**
 * Restore Request Controller
 * Handles creation, listing, approval, and rejection of version restore requests.
 * Enforces ownership checks to prevent IDOR vulnerabilities.
 */

const RestoreRequest = require('../models/RestoreRequest');
const Article = require('../models/Article');
const articleService = require('../services/articleService');
const logger = require('../utils/logger');

/**
 * Helper: Helper to check if a user is the owner or editor of an article.
 * Throws 403 if unauthorized.
 */
function verifyAccess(article, user, requiredRole) {
    const userId = user.id.toString();
    if (article.owner && article.owner.toString() === userId) {
        return;
    }
    if (!article.owner && article.author === user.username) {
        return;
    }

    const shareEntry = article.sharedWith.find(s => {
        const sharedUserId = s.user?._id ? s.user._id.toString() : s.user.toString();
        return sharedUserId === userId;
    });

    if (!shareEntry) {
        throw new Error('You do not have access to this article.');
    }

    const levels = { 'viewer': 1, 'editor': 2, 'owner': 3 };
    const userLevel = levels[shareEntry.permission];
    const requiredLevel = levels[requiredRole];

    if (!userLevel || userLevel < requiredLevel) {
        throw new Error(`Insufficient permissions. Required: ${requiredRole}`);
    }
}

/**
 * POST /api/restore-requests — Editor submits a restore request
 */
async function createRequest(req, res, next) {
    try {
        const { articleId, commitHash } = req.body;
        if (!articleId || !commitHash) {
            return res.status(400).json({ error: 'articleId and commitHash are required.' });
        }

        const article = await Article.findById(articleId);
        if (!article) return res.status(404).json({ error: 'Article not found.' });

        // Enforce editor permission check (IDOR check)
        try {
            verifyAccess(article, req.user, 'editor');
        } catch (err) {
            return res.status(403).json({ error: err.message });
        }

        // Owner does not need a restore request (can call restore endpoint directly)
        const isOwner = article.owner && article.owner.equals(req.user.id);
        if (isOwner) {
            return res.status(400).json({ error: 'You are the owner. You can restore this article directly.' });
        }

        // Check if there is already an identical pending request
        const existing = await RestoreRequest.findOne({
            article: articleId,
            commitHash,
            status: 'pending',
        });
        if (existing) {
            return res.status(409).json({ error: 'A pending restore request already exists for this version.' });
        }

        const request = await RestoreRequest.create({
            article: articleId,
            editor: req.user.id,
            commitHash,
        });

        logger.info(`Restore request created by editor '${req.user.username}' for article '${article.title}' to version ${commitHash.substring(0, 7)}`);
        
        res.status(201).json({
            message: 'Restore request sent to the owner.',
            request,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/restore-requests — Get all pending restore requests for articles owned by current user
 */
async function getMyPendingRequests(req, res, next) {
    try {
        // Find all articles owned by the current user
        const myArticles = await Article.find({ owner: req.user.id });
        const articleIds = myArticles.map(a => a._id);

        // Find pending requests for these articles
        const requests = await RestoreRequest.find({
            article: { $in: articleIds },
            status: 'pending',
        })
            .populate('article', 'title slug')
            .populate('editor', 'username')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/restore-requests/:id/approve — Owner approves and executes the restore
 */
async function approveRequest(req, res, next) {
    try {
        const request = await RestoreRequest.findById(req.params.id).populate('article');
        if (!request) return res.status(404).json({ error: 'Restore request not found.' });

        if (request.status !== 'pending') {
            return res.status(400).json({ error: `Request is already ${request.status}.` });
        }

        // IDOR check: Verify the current user is the owner of the requested article
        const isOwner = request.article && request.article.owner && request.article.owner.equals(req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'Only the article owner can approve restore requests.' });
        }

        // Execute the restore action using articleService (runs as the owner)
        await articleService.restoreArticle(request.article._id, request.commitHash, req.user);

        // Mark the request as approved
        request.status = 'approved';
        await request.save();

        logger.info(`Restore request ${req.params.id} APPROVED by owner '${req.user.username}'. Article '${request.article.title}' restored.`);
        
        res.json({ message: 'Request approved. Article has been restored.', request });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/restore-requests/:id/decline — Owner declines the restore request
 */
async function declineRequest(req, res, next) {
    try {
        const request = await RestoreRequest.findById(req.params.id).populate('article');
        if (!request) return res.status(404).json({ error: 'Restore request not found.' });

        if (request.status !== 'pending') {
            return res.status(400).json({ error: `Request is already ${request.status}.` });
        }

        // IDOR check: Verify the current user is the owner of the requested article
        const isOwner = request.article && request.article.owner && request.article.owner.equals(req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'Only the article owner can decline restore requests.' });
        }

        // Mark the request as declined
        request.status = 'declined';
        await request.save();

        logger.info(`Restore request ${req.params.id} DECLINED by owner '${req.user.username}'`);
        
        res.json({ message: 'Request declined.', request });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    createRequest,
    getMyPendingRequests,
    approveRequest,
    declineRequest,
};
