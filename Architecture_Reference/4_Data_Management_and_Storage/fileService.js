/**
 * File Service
 * Handles reading, writing, updating, and deleting article markdown files.
 * Articles are stored at the project root in /articles/<slug>.md
 */

const fs = require('fs').promises;
const path = require('path');

// Articles directory lives at project root (outside /server)
const ARTICLES_DIR = path.resolve(__dirname, '../../articles');

/**
 * Validates that a slug is safe and the resolved path is within ARTICLES_DIR.
 * @param {string} slug - Article slug
 * @throws {Error} if path traversal detected
 */
function getSafePath(slug) {
    // Allow only alphanumeric, dashes, and underscores
    if (!/^[a-z0-9-_]+$/i.test(slug)) {
        throw new Error('Invalid slug format');
    }

    const filePath = path.join(ARTICLES_DIR, `${slug}.md`);

    // Prevent directory traversal
    if (!filePath.startsWith(ARTICLES_DIR)) {
        throw new Error('Invalid file path');
    }

    return filePath;
}

/**
 * Ensure the articles directory exists.
 */
async function ensureDir() {
    await fs.mkdir(ARTICLES_DIR, { recursive: true });
}

/**
 * Write or overwrite an article file.
 * @param {string} slug - Article slug (used as filename)
 * @param {string} content - Markdown content
 */
async function writeArticle(slug, content) {
    await ensureDir();
    const filePath = getSafePath(slug);
    await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Read an article file.
 * @param {string} slug - Article slug
 * @returns {Promise<string>} Markdown content
 */
async function readArticle(slug) {
    const filePath = getSafePath(slug);
    return fs.readFile(filePath, 'utf-8');
}

/**
 * Delete an article file.
 * @param {string} slug - Article slug
 */
async function deleteArticle(slug) {
    const filePath = getSafePath(slug);
    await fs.unlink(filePath);
}

/**
 * Check if an article file exists.
 * @param {string} slug - Article slug
 * @returns {Promise<boolean>}
 */
async function articleExists(slug) {
    try {
        const filePath = getSafePath(slug);
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    writeArticle,
    readArticle,
    deleteArticle,
    articleExists,
    ARTICLES_DIR,
};
