/**
 * Restore Request Model
 * Tracks restore requests sent by editors to article owners.
 */

const mongoose = require('mongoose');

const restoreRequestSchema = new mongoose.Schema(
    {
        // The article being restored
        article: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Article',
            required: true,
        },
        // The editor requesting the restoration
        editor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // The target git commit hash
        commitHash: {
            type: String,
            required: true,
        },
        // Request status
        status: {
            type: String,
            enum: ['pending', 'approved', 'declined'],
            default: 'pending',
        },
    },
    { timestamps: true }
);

// Prevent duplicate pending restore requests for the same version by the same editor
restoreRequestSchema.index({ article: 1, editor: 1, commitHash: 1, status: 1 });

module.exports = mongoose.model('RestoreRequest', restoreRequestSchema);
