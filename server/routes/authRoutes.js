/**
 * Auth Routes
 * Handles user registration, login, verification, and password resets with rate limiting.
 */

const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const logger = require('../utils/logger');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('username').notEmpty().withMessage('Username is required').trim().isLength({ min: 3 }),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
    body('username').notEmpty().withMessage('Username is required').trim(),
    body('password').notEmpty().withMessage('Password is required'),
];

const forgotValidation = [
    body('email').isEmail().withMessage('Valid email address is required').normalizeEmail(),
];

const resetValidation = [
    body('token').notEmpty().withMessage('Reset token is required').trim(),
    body('password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
];

// POST /api/auth/register — Create a new account
router.post('/register', registerLimiter, registerValidation, authController.register);

// POST /api/auth/login — Sign in and establish HttpOnly refresh session
router.post('/login', authLimiter, loginValidation, authController.login);

// POST /api/auth/refresh — Rotate access token
router.post('/refresh', authController.refresh);

// POST /api/auth/logout — Revoke session
router.post('/logout', authController.logout);

// GET /api/auth/verify-email — Verify account email
router.get('/verify-email', authController.verifyEmail);

// POST /api/auth/forgot-password — Request password reset
router.post('/forgot-password', authLimiter, forgotValidation, authController.forgotPassword);

// POST /api/auth/reset-password — Perform password reset
router.post('/reset-password', authLimiter, resetValidation, authController.resetPassword);

module.exports = router;
