/**
 * User Model
 * Mongoose schema for authentication and role-based access control.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            trim: true,
            minlength: 3,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
        },
        // Stored as bcrypt hash
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 6,
        },
        // Soft delete flag: if false, user cannot login or access content
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

/**
 * Hash password before saving if it has been modified.
 */
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

/**
 * Compare a candidate password against the stored hash.
 * @param {string} candidatePassword - Plain-text password to check
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
