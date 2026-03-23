/**
 * smoke_test.js
 * Automated smoke test for wiki API.
 * Requires: running server on http://localhost:3000
 */

// Use node's fetch (Node 18+)
const assert = require('assert');

const API = 'http://localhost:3000/api';
let TOKEN = '';
let ARTICLE_ID = '';

async function run() {
    try {
        console.log('--- Starting Smoke Tests ---');

        console.log('[1] Testing Registration...');
        const userRes = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `testuser_${Date.now()}`,
                password: 'password123',
                role: 'editor'
            })
        });
        const user = await userRes.json();
        assert.strictEqual(userRes.status, 201, `Status ${userRes.status}: ${JSON.stringify(user)}`);
        TOKEN = user.token;
        console.log('✅ Registration OK');

        console.log('[2] Testing Create Article...');
        const createRes = await fetch(`${API}/articles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                title: `Smoke Test Article ${Date.now()}`,
                content: '# Hello World\nThis is a test.',
                tags: ['test', 'smoke']
            })
        });
        const article = await createRes.json();
        assert.strictEqual(createRes.status, 201, `Status ${createRes.status}: ${JSON.stringify(article)}`);
        ARTICLE_ID = article._id;
        console.log('✅ Create Article OK');

        console.log('[3] Testing Get Article...');
        const getRes = await fetch(`${API}/articles/${ARTICLE_ID}`);
        const fetched = await getRes.json();
        assert.strictEqual(getRes.status, 200);
        assert.strictEqual(fetched.title, article.title);
        console.log('✅ Get Article OK');

        console.log('[4] Testing Search...');
        const searchRes = await fetch(`${API}/search?q=Smoke`);
        const searchResults = await searchRes.json();
        assert.strictEqual(searchRes.status, 200);
        assert.ok(searchResults.length > 0);
        console.log('✅ Search OK');

        console.log('[5] Testing Update Article...');
        const updateRes = await fetch(`${API}/articles/${ARTICLE_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                content: '# Use Updated Content\nThis is updated.'
            })
        });
        const updated = await updateRes.json();
        assert.strictEqual(updateRes.status, 200, `Status ${updateRes.status}: ${JSON.stringify(updated)}`);
        assert.strictEqual(updated.content, '# Use Updated Content\nThis is updated.'); // Actually content is not returned in update by default unless specifically asked or implemented, checking implementation...
        // articleService.updateArticle returns { ...toObject(), content: data.content } -> YES it returns content
        console.log('✅ Update Article OK');

        console.log('[6] Testing History...');
        const historyRes = await fetch(`${API}/articles/${ARTICLE_ID}/history`);
        const history = await historyRes.json();
        assert.strictEqual(historyRes.status, 200);
        assert.ok(Array.isArray(history));
        assert.ok(history.length >= 2, `Expected at least 2 commits, got ${history.length}`);
        console.log('✅ History OK');

        console.log('[7] Testing Delete Article...');
        const deleteRes = await fetch(`${API}/articles/${ARTICLE_ID}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        assert.strictEqual(deleteRes.status, 200);
        console.log('✅ Delete Article OK');

        console.log('--- All Tests Passed ---');
    } catch (err) {
        console.error('❌ Test Failed:', err);
        process.exit(1);
    }
}

// Wait for server to be ready (dumb wait)
setTimeout(run, 3000);
