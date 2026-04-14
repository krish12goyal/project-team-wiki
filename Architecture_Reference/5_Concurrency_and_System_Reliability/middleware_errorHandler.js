/**
 * Global Error Handler Middleware
 * Catches all errors thrown in route handlers and returns a consistent JSON response.
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
    // Log the full error
    logger.error(`${err.message}`, {
        stack: err.stack,
        path: req.originalUrl,
        method: req.method,
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({ error: 'Validation failed', details: messages });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({ error: `Duplicate value for field: ${field}` });
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        return res.status(400).json({ error: 'Invalid ID format.' });
    }

    // Default server error
    const status = err.statusCode || 500;
    res.status(status).json({
        error: err.message || 'Internal server error',
    });
}

module.exports = errorHandler;
