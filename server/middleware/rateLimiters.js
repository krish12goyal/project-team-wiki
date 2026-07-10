/**
 * Rate Limiters — Centralised Abuse Protection
 *
 * All rate limiters live here so they can be imported consistently
 * across every route file without duplicating configuration.
 *
 * Limits are intentionally strict for write/auth operations and
 * more generous for read operations to allow normal browsing.
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Helper: build a standard limiter with security logging on trigger
// ---------------------------------------------------------------------------
function makeLimiter({ name, windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,  // Return RateLimit-* headers (RFC 6585)
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        handler(req, res, _next, options) {
            logger.warn(
                `RATE LIMIT [${name}]: IP ${req.ip} exceeded limit on ${req.method} ${req.originalUrl}`
            );
            res.status(options.statusCode).json(options.message);
        },
    });
}

// ---------------------------------------------------------------------------
// Global API limiter — broad safety net on all /api/* routes
// 150 requests per 15 min covers normal browsing comfortably.
// ---------------------------------------------------------------------------
const globalApiLimiter = makeLimiter({
    name: 'GLOBAL_API',
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: 'Too many requests from this IP. Please slow down and try again later.',
});

// ---------------------------------------------------------------------------
// Auth — brute-force protection for login / password-reset / verify
// Very strict: 5 attempts per 15 min window.
// ---------------------------------------------------------------------------
const authLimiter = makeLimiter({
    name: 'AUTH',
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many attempts. Please wait 15 minutes before trying again.',
});

// ---------------------------------------------------------------------------
// Registration — prevents bulk account creation by bots
// 10 accounts per 15 min per IP is more than enough for real users.
// ---------------------------------------------------------------------------
const registerLimiter = makeLimiter({
    name: 'REGISTER',
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many accounts created from this IP. Please try again later.',
});

// ---------------------------------------------------------------------------
// Article write operations — create / update / delete / restore
// Prevents a bot hammering the write path (disk + DB + git writes).
// 30 write ops per 15 min is generous for any real editor.
// ---------------------------------------------------------------------------
const articleWriteLimiter = makeLimiter({
    name: 'ARTICLE_WRITE',
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many article write requests. Please slow down.',
});

// ---------------------------------------------------------------------------
// Search limiter — prevents scraping the entire article corpus via search
// 60 searches per 15 min = 4 per minute, enough for interactive use.
// ---------------------------------------------------------------------------
const searchLimiter = makeLimiter({
    name: 'SEARCH',
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: 'Too many search requests. Please slow down.',
});

// ---------------------------------------------------------------------------
// Invitation limiter — prevents bulk-invite spam
// 20 invites per 15 min is plenty for a legitimate owner.
// ---------------------------------------------------------------------------
const invitationLimiter = makeLimiter({
    name: 'INVITATION',
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many invitation requests. Please slow down.',
});

// ---------------------------------------------------------------------------
// Restore request limiter — prevents editors flooding owners with requests
// 10 per hour is very generous for a real workflow.
// ---------------------------------------------------------------------------
const restoreRequestLimiter = makeLimiter({
    name: 'RESTORE_REQUEST',
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 10,
    message: 'Too many restore requests sent. Please wait before sending more.',
});

module.exports = {
    globalApiLimiter,
    authLimiter,
    registerLimiter,
    articleWriteLimiter,
    searchLimiter,
    invitationLimiter,
    restoreRequestLimiter,
};
