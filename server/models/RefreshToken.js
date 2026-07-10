/**
 * Refresh Token Model
 * Stores single-use rotating refresh tokens linked to users.
 */

const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
    {
        // The token value (cryptographically secure hex string)
        token: {
            type: String,
            required: true,
            unique: true,
        },
        // The user associated with this token
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Token expiration timestamp
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// Auto-delete expired refresh tokens using MongoDB TTL index
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
