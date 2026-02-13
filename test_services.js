/**
 * test_services.js
 * Unit test for fileService and gitService.
 * Does not require MongoDB.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fileService = require('./server/services/fileService');
const gitService = require('./server/services/gitService');

const TEST_SLUG = 'test-article-verify';
const TEST_CONTENT = '# Verification Test\nThis article ensures services work correctly.';

async function run() {
    try {
        console.log('--- Unit Testing Services ---');

        // Clean up previous test
        if (await fileService.articleExists(TEST_SLUG)) {
            await fileService.deleteArticle(TEST_SLUG);
            gitService.autoCommit('Cleanup test article');
        }

        // 1. fileService: Write Article
        console.log('[1] Testing fileService.writeArticle...');
        await fileService.writeArticle(TEST_SLUG, TEST_CONTENT);
        const exists = await fileService.articleExists(TEST_SLUG);
        assert.strictEqual(exists, true, 'File should exist');
        console.log('✅ Write Article OK');

        // 2. fileService: Read Article
        console.log('[2] Testing fileService.readArticle...');
        const readContent = await fileService.readArticle(TEST_SLUG);
        assert.strictEqual(readContent, TEST_CONTENT, 'Content mismatch');
        console.log('✅ Read Article OK');

        // 3. gitService: Auto-commit
        console.log('[3] Testing gitService.autoCommit...');
        // We already auto-committed in main code but here let's trigger it manually
        gitService.gitAdd();
        gitService.gitCommit('Test commit verification');

        // Check git log
        const history = gitService.gitLog(`articles/${TEST_SLUG}.md`);
        assert.ok(history.length > 0, 'Git history should not be empty');
        const lastCommit = history[0];
        assert.strictEqual(lastCommit.message, 'Test commit verification');
        console.log('✅ Git Commit & Log OK');

        // 4. Verification of Path Traversal protection
        console.log('[4] Testing Path Traversal Protection...');
        try {
            await fileService.readArticle('../../../etc/passwd');
            assert.fail('Should prevent directory traversal');
        } catch (err) {
            assert.strictEqual(err.message, 'Invalid slug format', 'Should block invalid slug');
            console.log('✅ Traversal Protection OK');
        }

        // 5. Cleanup
        console.log('[5] Cleanup...');
        await fileService.deleteArticle(TEST_SLUG);
        gitService.autoCommit('Remove test article');
        const cleaned = await fileService.articleExists(TEST_SLUG);
        assert.strictEqual(cleaned, false, 'File should be deleted');
        console.log('✅ Cleanup OK');

        console.log('--- All Service Tests Passed ---');
        process.exit(0);

    } catch (err) {
        console.error('❌ Service Test Failed:', err);
        process.exit(1);
    }
}

run();
