/**
 * Git Service
 * Wraps git CLI commands via child_process.
 * All commands run in the project root directory.
 * Git failures are logged but never crash the server.
 */

const { execSync } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

// Project root is two levels up from /server/services/
const PROJECT_ROOT = path.resolve(__dirname, '../../');

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
 * Execute a git command safely.
 * @param {string} command - Full git command string
 * @returns {string} stdout output (trimmed)
 */
function execGit(command) {
    try {
        const output = execSync(command, {
            cwd: PROJECT_ROOT,
            encoding: 'utf-8',
            timeout: 15000, // 15-second timeout
        });
        return output.trim();
    } catch (error) {
        logger.error(`Git command failed: ${command}`, { error: error.message });
        return '';
    }
}

/**
 * Stage all changes.
 */
function gitAdd() {
    return execGit('git add .');
}

/**
 * Commit with a message.
 * @param {string} message - Commit message
 */
function gitCommit(message) {
    // Escape double quotes and backslashes in the message
    const safeMsg = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return execGit(`git commit -m "${safeMsg}"`);
}

/**
 * Push to remote (only if GIT_AUTO_PUSH is enabled).
 */
function gitPush() {
    if (process.env.GIT_AUTO_PUSH === 'true') {
        return execGit('git push');
    }
}

/**
 * Perform add + commit + optional push in one call.
 * @param {string} message - Commit message
 */
function autoCommit(message) {
    gitAdd();
    gitCommit(message);
    gitPush();
}

/**
 * Get git log for a specific file.
 * @param {string} filePath - Relative path from project root (e.g. articles/my-article.md)
 * @param {number} [limit=50] - Max number of entries
 * @returns {Array<{hash: string, date: string, message: string, author: string}>}
 */
function gitLog(filePath, limit = 50) {
    if (!isValidPath(filePath)) {
        logger.warn(`Invalid git log path: ${filePath}`);
        return [];
    }

    const SEP = '|||';
    // Use -- formatting to separate revision from path
    const raw = execGit(
        `git log -n ${parseInt(limit)} --pretty=format:"%H${SEP}%ai${SEP}%s${SEP}%an" -- "${filePath}"`
    );
    if (!raw) return [];

    return raw.split('\n').map((line) => {
        const [hash, date, message, author] = line.split(SEP);
        return { hash, date, message, author };
    });
}

/**
 * Show a file's content at a specific commit.
 * @param {string} commitHash - Git commit hash
 * @param {string} filePath - Relative path from project root
 * @returns {string} File content at that commit
 */
function gitShow(commitHash, filePath) {
    if (!isValidHash(commitHash)) {
        throw new Error('Invalid commit hash');
    }
    if (!isValidPath(filePath)) {
        throw new Error('Invalid file path');
    }
    return execGit(`git show ${commitHash}:"${filePath}"`);
}

/**
 * Restore a file to its state at a specific commit.
 * @param {string} commitHash - Git commit hash
 * @param {string} filePath - Relative path from project root
 */
function gitRestore(commitHash, filePath) {
    if (!isValidHash(commitHash)) {
        throw new Error('Invalid commit hash');
    }
    if (!isValidPath(filePath)) {
        throw new Error('Invalid file path');
    }
    return execGit(`git checkout ${commitHash} -- "${filePath}"`);
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
