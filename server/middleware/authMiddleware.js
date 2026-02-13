/**
 * Auth Middleware
 * JWT verification and role-based access control.
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Verify JWT token from Authorization header.
 * Attaches decoded user to req.user.
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    // No token provided -> 401
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Provide Bearer token.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, username, role }
        next();
    } catch (err) {
        logger.warn(`Invalid token attempt: ${err.message}`);
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

/**
 * Require a specific role (or array of roles).
 * Must be used after authenticate middleware.
 * @param  {...string} roles - Allowed roles (e.g. 'editor')
 */
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions.' });
        }
        next();
    };
}

module.exports = { authenticate, authorize };
