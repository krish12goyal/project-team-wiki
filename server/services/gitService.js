/**
 * Git Service
 * Wraps git CLI commands via child_process.
 * All commands run in the project root directory.
 * 
 * NOW ASYNC & CONCURRENCY SAFE.
 */

const { execFile } = require('child_process');
const util = require('util');
const path = require('path');
const logger = require('../utils/logger');

const execFileAsync = util.promisify(execFile);

// Project root is two levels up from /server/services/
const PROJECT_ROOT = path.resolve(__dirname, '../../');

// Simple Mutex for sequential Git operations
class Mutex {
    constructor() {
        this.queue = Promise.resolve();
    }

    lock(callback) {
        const next = this.queue.then(() => callback().catch(err => {
            logger.error('Error within Git mutex lock:', err);
            throw err;
        }));
        this.queue = next.catch(() => { }); // Prevent queue blockage on error
        return next;
    }
}

const gitMutex = new Mutex();

/**
 * Validate commit hash format (hex string).
 */
function isValidHash(hash) {
    return /^[a-f0-9]+$/i.test(hash);
}

/**
 * Validate relative file path (must not contain .. or start with /).
 */
function isValidPath(filePath) {
    const normalized = path.normalize(filePath);
    return !normalized.startsWith('..') && !path.isAbsolute(normalized);
}

/**
 * Execute a git command safely (Async).
 * @param {string[]} args - git arguments (e.g., ['commit', '-m', message])
 * @returns {Promise<string>} stdout output (trimmed)
 */
async function execGit(args) {
    try {
        const { stdout } = await execFileAsync('git', args, {
            cwd: PROJECT_ROOT,
            encoding: 'utf-8',
            timeout: 30000, // 30-second timeout
        });
        return stdout.trim();
    } catch (error) {
        logger.error(`Git command failed: git ${args.join(' ')}`, { error: error.message, stderr: error.stderr });
        throw error; // Re-throw to let caller handle it
    }
}

/**
 * Stage all changes.
 */
async function gitAdd() {
    return execGit(['add', '.']);
}

/**
 * Commit with a message.
 * @param {string} message - Commit message
 */
async function gitCommit(message) {
    // Check if there are changes to commit first to avoid empty commit errors
    try {
        await execGit(['commit', '-m', message]);
    } catch (err) {
        if (err.stdout && err.stdout.includes('nothing to commit')) {
            logger.info('Nothing to commit, skipping.');
            return;
        }
        throw err;
    }
}

/**
 * Push to remote (only if GIT_AUTO_PUSH is enabled) with retry.
 */
async function gitPush() {
    if (process.env.GIT_AUTO_PUSH === 'true') {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                logger.info(`Git push attempt ${attempts + 1}/${maxAttempts}`);
                await execGit(['push']);
                logger.info('Git push successful');
                return;
            } catch (err) {
                attempts++;
                logger.warn(`Git push failed (attempt ${attempts}): ${err.message}`);
                if (attempts >= maxAttempts) {
                    logger.error('Git push failed after max retries.');
                    throw err;
                }
                // Wait before retrying (exponential backoff: 1s, 2s, 4s...)
                await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempts - 1)));
            }
        }
    }
}

/**
 * Perform add + commit + optional push in one call, serialized via Mutex.
 * @param {string} message - Commit message
 */
async function autoCommit(message) {
    return gitMutex.lock(async () => {
        logger.info(`Starting auto-commit: "${message}"`);
        await gitAdd();
        await gitCommit(message);
        await gitPush();
        logger.info('Auto-commit completed successfully.');
    });
}

/**
 * Get git log for a specific file.
 * @param {string} filePath - Relative path from project root (e.g. articles/my-article.md)
 * @param {number} [limit=50] - Max number of entries
 * @returns {Promise<Array<{hash: string, date: string, message: string, author: string}>>}
 */
async function gitLog(filePath, limit = 50) {
    if (!isValidPath(filePath)) {
        logger.warn(`Invalid git log path: ${filePath}`);
        return [];
    }

    const SEP = '|||';
    try {
        const raw = await execGit([
            'log', 
            '-n', 
            parseInt(limit).toString(), 
            `--pretty=format:%H${SEP}%ai${SEP}%s${SEP}%an`, 
            '--', 
            filePath
        ]);

        if (!raw) return [];

        return raw.split('\n').map((line) => {
            const [hash, date, message, author] = line.split(SEP);
            return { hash, date, message, author };
        });
    } catch (err) {
        // If file doesn't exist in git yet, it might return error or empty. 
        // We'll treat as empty history.
        logger.warn(`git log failed for ${filePath}: ${err.message}`);
        return [];
    }
}

/**
 * Show a file's content at a specific commit.
 * @param {string} commitHash - Git commit hash
 * @param {string} filePath - Relative path from project root
 * @returns {Promise<string>} File content at that commit
 */
async function gitShow(commitHash, filePath) {
    if (!isValidHash(commitHash)) {
        throw new Error('Invalid commit hash');
    }
    if (!isValidPath(filePath)) {
        throw new Error('Invalid file path');
    }
    return execGit(['show', `${commitHash}:${filePath}`]);
}

/**
 * Restore a file to its state at a specific commit.
 * @param {string} commitHash - Git commit hash
 * @param {string} filePath - Relative path from project root
 */
async function gitRestore(commitHash, filePath) {
    if (!isValidHash(commitHash)) {
        throw new Error('Invalid commit hash');
    }
    if (!isValidPath(filePath)) {
        throw new Error('Invalid file path');
    }
    // We use the mutex here too to avoid conflicts with ongoing commits
    return gitMutex.lock(async () => {
        await execGit(['checkout', commitHash, '--', filePath]);
    });
}

module.exports = {
    autoCommit,
    gitLog,
    gitShow,
    gitRestore,
    gitAdd,
    gitCommit,
    PROJECT_ROOT,
};
