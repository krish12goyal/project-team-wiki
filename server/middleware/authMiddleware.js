/**
 * Auth Middleware
 * JWT verification and role-based access control.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Verify JWT token from Authorization header.
 * Attaches fresh user to req.user after checking active state.
 */
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    // No token provided -> 401
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Provide Bearer token.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch user to ensure they are still active
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'User account is disabled.' });
        }

        req.user = { id: user._id, username: user.username };
        next();
    } catch (err) {
        logger.warn(`Invalid token attempt: ${err.message}`);
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { authenticate };
