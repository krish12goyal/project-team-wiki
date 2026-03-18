/**
 * Auth Routes
 * Handles user registration and login with rate limiting.
 */

const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const router = express.Router();

// Rate limiter: max 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation rules
const registerValidation = [
    body('username').notEmpty().withMessage('Username is required').trim().isLength({ min: 3 }),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }),
    body('role').optional().isIn(['editor', 'viewer']).withMessage('Role must be editor or viewer'),
];

const loginValidation = [
    body('username').notEmpty().withMessage('Username is required').trim(),
    body('password').notEmpty().withMessage('Password is required'),
];

// POST /api/auth/register
router.post('/register', authLimiter, registerValidation, authController.register);

// POST /api/auth/login
router.post('/login', authLimiter, loginValidation, authController.login);

// POST /api/auth/refresh
router.post('/refresh', authController.refresh);

module.exports = router;
