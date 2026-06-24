/**
 * Invitation Model
 * Tracks article share invitations sent between users.
 * Replaces direct-grant sharing with an invite-then-accept flow.
 */

const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
    {
        // The article being shared
        article: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Article',
            required: true,
        },
        // Who sent the invite (must be owner)
        fromUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Who is being invited
        toUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Permission being offered
        permission: {
            type: String,
            enum: ['viewer', 'editor'],
            required: true,
        },
        // Lifecycle status
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined'],
            default: 'pending',
        },
    },
    { timestamps: true }
);

// Prevent duplicate pending invitations for the same article+user combo
invitationSchema.index({ article: 1, toUser: 1 });

module.exports = mongoose.model('Invitation', invitationSchema);
