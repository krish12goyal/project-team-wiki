/**
 * Auth Controller
 * Handles user registration and login with JWT token generation.
 */

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register — Create a new user account
 */
async function register(req, res, next) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { username, email, password } = req.body;

        // Check if username already exists
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const user = await User.create({ username, email: email.toLowerCase(), password });

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info(`User registered: ${username}`);
        res.status(201).json({
            message: 'User registered',
            token,
            user: { id: user._id, username: user.username },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/login — Authenticate and return JWT
 */
async function login(req, res, next) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { username, password } = req.body;

        // Try to find user by username or email
        const user = await User.findOne({
            $or: [
                { username: username },
                { email: username.toLowerCase() }
            ]
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'User account is disabled' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info(`User logged in: ${user.username}`);
        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, username: user.username },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/refresh — Refresh an expired JWT token
 * Decodes the expired token, verifies the user still exists, and issues a new token.
 */
async function refresh(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const oldToken = authHeader.split(' ')[1];

        // Decode even if expired — we just need the user id
        let decoded;
        try {
            decoded = jwt.verify(oldToken, process.env.JWT_SECRET, { ignoreExpiration: true });
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token.' });
        }

        // Make sure the user still exists in the database
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'User account is disabled' });
        }

        // Issue a fresh token
        const newToken = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info(`Token refreshed for user: ${user.username}`);
        res.json({
            message: 'Token refreshed',
            token: newToken,
            user: { id: user._id, username: user.username },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { register, login, refresh };
