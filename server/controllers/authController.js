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

        const { username, email, password, role } = req.body;

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

        const user = await User.create({ username, email: email.toLowerCase(), password, role: role || 'editor' });

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info(`User registered: ${username} (${user.role})`);
        res.status(201).json({
            message: 'User registered',
            token,
            user: { id: user._id, username: user.username, role: user.role },
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

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info(`User logged in: ${user.username}`);
        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, username: user.username, role: user.role },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { register, login };
