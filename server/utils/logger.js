/**
 * Logger Utility
 * Winston-based logger that writes to console and log files.
 */

const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
        })
    ),
    transports: [
        // Console output (colourised)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `[${timestamp}] ${level}: ${message}`;
                })
            ),
        }),
        // File output
        new winston.transports.File({
            filename: path.resolve(__dirname, '../../logs/error.log'),
            level: 'error',
        }),
        new winston.transports.File({
            filename: path.resolve(__dirname, '../../logs/combined.log'),
        }),
    ],
});

module.exports = logger;
