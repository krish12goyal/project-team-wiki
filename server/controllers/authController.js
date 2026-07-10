/**
 * Auth Controller
 * Handles registration, email verification, login, HttpOnly refresh token rotation, logout, and password resets.
 * Implements security auditing logs with IP tracking and revokes sessions on password resets.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');

/**
 * Helper: Extract cookie by name from request headers manually.
 */
function getCookie(req, name) {
    if (!req.headers.cookie) return null;
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        const [k, v] = cookie.split('=');
        if (k === name) return v ? decodeURIComponent(v) : null;
    }
    return null;
}

/**
 * POST /api/auth/register — Create a new user account (Rate limited)
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

        // Generate email verification token (expires in 24 hours)
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password,
            isEmailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
        });

        // Log verification link (no SMTP configured)
        logger.info(`\n[SECURITY AUDIT] EMAIL VERIFICATION TOKEN GENERATED\nUser: ${user.username}\nLink: http://localhost:3000/api/auth/verify-email?token=${verificationToken}\nIP: ${req.ip}\n`);

        logger.info(`User registered (Pending Verification): ${username} from IP ${req.ip}`);
        res.status(201).json({
            message: 'Registration successful! Please verify your email address to continue. The verification link has been logged to the server console.',
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/login — Authenticate, set HttpOnly Refresh Token cookie, and return short-lived access JWT
 */
async function login(req, res, next) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { username, password } = req.body;

        // Find user by username or email
        const user = await User.findOne({
            $or: [
                { username: username },
                { email: username.toLowerCase() }
            ]
        });

        if (!user) {
            logger.warn(`FAILED LOGIN: Invalid username/email attempt '${username}' from IP ${req.ip}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.isActive) {
            logger.warn(`FAILED LOGIN: Attempt to access disabled account '${user.username}' from IP ${req.ip}`);
            return res.status(403).json({ error: 'User account is disabled' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            logger.warn(`FAILED LOGIN: Incorrect password attempt for user '${user.username}' from IP ${req.ip}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Enforce email verification check
        if (!user.isEmailVerified) {
            logger.warn(`FAILED LOGIN: Attempt to access unverified account '${user.username}' from IP ${req.ip}`);
            return res.status(403).json({
                error: 'Please verify your email address before logging in. The verification link has been logged to the server console.',
            });
        }

        // Generate short-lived Access Token (expires in 1 hour)
        const accessToken = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Generate cryptographically secure Refresh Token (expires in 7 days)
        const rawRefreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await RefreshToken.create({
            token: rawRefreshToken,
            user: user._id,
            expiresAt,
        });

        // Set refresh token in HttpOnly, SameSite=Strict, Secure cookie
        res.cookie('refreshToken', rawRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        logger.info(`SUCCESSFUL LOGIN: User '${user.username}' logged in from IP ${req.ip}`);

        res.json({
            message: 'Login successful',
            token: accessToken,
            user: { id: user._id, username: user.username },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/refresh — Refresh access token using secure Refresh Token Rotation
 */
async function refresh(req, res, next) {
    try {
        const tokenVal = getCookie(req, 'refreshToken');
        if (!tokenVal) {
            return res.status(401).json({ error: 'Refresh token missing. Authentication required.' });
        }

        // Lookup refresh token in DB
        const dbToken = await RefreshToken.findOne({ token: tokenVal }).populate('user');
        if (!dbToken) {
            return res.status(401).json({ error: 'Invalid refresh token.' });
        }

        // Verify expiration
        if (dbToken.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: dbToken._id });
            return res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
        }

        const user = dbToken.user;
        if (!user || !user.isActive || !user.isEmailVerified) {
            await RefreshToken.deleteOne({ _id: dbToken._id });
            return res.status(401).json({ error: 'User is inactive or unverified.' });
        }

        // --- REFRESH TOKEN ROTATION ---
        // 1. Delete the used refresh token
        await RefreshToken.deleteOne({ _id: dbToken._id });

        // 2. Generate a new Access Token
        const newAccessToken = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // 3. Generate and save a new Refresh Token
        const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await RefreshToken.create({
            token: newRawRefreshToken,
            user: user._id,
            expiresAt,
        });

        // 4. Set the new Refresh Token in HttpOnly cookie
        res.cookie('refreshToken', newRawRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        logger.info(`TOKEN ROTATED: Session refreshed for user '${user.username}' from IP ${req.ip}`);

        res.json({
            token: newAccessToken,
            user: { id: user._id, username: user.username },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/logout — Log out user and revoke refresh token
 */
async function logout(req, res, next) {
    try {
        const tokenVal = getCookie(req, 'refreshToken');
        if (tokenVal) {
            // Delete token from database to prevent replay
            await RefreshToken.deleteOne({ token: tokenVal });
        }

        // Clear browser cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        logger.info(`LOGOUT: Session closed successfully from IP ${req.ip}`);
        res.json({ message: 'Logout successful' });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/auth/verify-email — Verify user email address from query token
 */
async function verifyEmail(req, res, next) {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send('<h1>Bad Request</h1><p>Verification token is required.</p>');
        }

        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: new Date() },
        });

        if (!user) {
            logger.warn(`EMAIL VERIFY FAILED: Invalid or expired token attempt from IP ${req.ip}`);
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Verification Failed - Team Wiki</title>
                    <style>
                        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                        .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px; max-width: 450px; text-align: center; }
                        h1 { color: #ef4444; }
                        p { color: #94a3b8; line-height: 1.6; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Verification Failed</h1>
                        <p>The verification link is invalid, already used, or expired. Please contact support or register again.</p>
                    </div>
                </body>
                </html>
            `);
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        logger.info(`EMAIL VERIFIED: User '${user.username}' verified email from IP ${req.ip}`);

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verified - Team Wiki</title>
                <style>
                    body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px; max-width: 450px; width: 100%; text-align: center; }
                    h1 { color: #10b981; margin-bottom: 16px; font-size: 1.75rem; }
                    p { color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
                    .btn { background: #3b82f6; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; }
                    .btn:hover { background: #2563eb; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
                    <h1>Email Verified Successfully!</h1>
                    <p>Your email address has been verified. You can now log in to access your articles.</p>
                    <a href="/login" class="btn">Go to Login Page</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/forgot-password — Request password reset link (Rate limited)
 */
async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email address is required.' });

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (user) {
            // Generate password reset token (expires in 1 hour)
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000);

            user.passwordResetToken = resetToken;
            user.passwordResetExpires = resetExpires;
            await user.save();

            // Log password reset link (no SMTP configured)
            logger.info(`\n[SECURITY AUDIT] PASSWORD RESET TOKEN GENERATED\nUser: ${user.username}\nLink: http://localhost:3000/reset-password.html?token=${resetToken}\nIP: ${req.ip}\n`);
        }

        logger.info(`PASSWORD RESET REQUESTED: For email '${email}' from IP ${req.ip}`);
        
        // Return identical response to prevent account enumeration
        res.json({
            message: 'If a user with that email exists, a password reset link has been logged to the server console.',
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/reset-password — Complete password reset (Rate limited)
 */
async function resetPassword(req, res, next) {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
        });

        if (!user) {
            logger.warn(`PASSWORD RESET FAILED: Invalid or expired token attempt from IP ${req.ip}`);
            return res.status(400).json({ error: 'Invalid or expired password reset token.' });
        }

        // Set new password (the model pre-save hook will hash this via bcrypt)
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        // Revoke all active refresh sessions for the user to force logout on all devices
        await RefreshToken.deleteMany({ user: user._id });

        logger.info(`PASSWORD RESET SUCCESS: Password reset completed successfully for user '${user.username}' from IP ${req.ip}. All active sessions revoked.`);
        
        res.json({
            message: 'Password reset successful. You can now log in with your new password.',
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    register,
    login,
    refresh,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
};
