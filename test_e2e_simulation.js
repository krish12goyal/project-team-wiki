/**
 * End-to-End Test Script (Simulating Browser Flow)
 * 
 * 1. Register User
 * 2. Login
 * 3. Create Article
 * 4. Update Article
 * 5. Verify History
 * 6. Delete Article
 */

const http = require('http');

const PORT = 3000;
let AUTH_TOKEN = '';

// Helper for HTTP requests
function request(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (AUTH_TOKEN) {
            options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    console.error('Failed to parse JSON:', body);
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', (err) => {
            console.error(`Request Error (${method} ${path}):`, err.message);
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runE2E() {
    console.log('--- Starting E2E Simulation ---');

    const username = `testuser_${Date.now()}`;
    const password = 'password123';

    try {
        // 1. Register
        console.log(`\n1. Registering user: ${username}`);
        let ieRegRes = await request('POST', '/api/auth/register', { username, password, role: 'editor' });

        // If 400 because user exists, try logging in
        if (ieRegRes.status === 400 && ieRegRes.body.error === 'Username already exists') {
            console.log('User exists, proceeding to login.');
        } else if (ieRegRes.status !== 201) {
            console.error('Registration failed:', ieRegRes.status, ieRegRes.body);
            return;
        } else {
            console.log('Registration success.');
        }

        // 2. Login
        console.log('\n2. Logging in...');
        const loginRes = await request('POST', '/api/auth/login', { username, password });
        if (loginRes.status !== 200) {
            console.error('Login failed:', loginRes.status, loginRes.body);
            return;
        }
        AUTH_TOKEN = loginRes.body.token;
        console.log('Login success, token received.');

        // 3. Create Article
        console.log('\n3. Creating article...');
        const createRes = await request('POST', '/api/articles', {
            title: `E2E Test ${Date.now()}`,
            content: 'Initial content',
            tags: ['e2e']
        });
        if (createRes.status !== 201) {
            console.error('Creation failed:', createRes.status, createRes.body);
            return;
        }
        const articleId = createRes.body._id;
        console.log('Article created:', articleId);

        // 4. Update Article
        console.log('\n4. Updating article...');
        const updateRes = await request('PUT', `/api/articles/${articleId}`, {
            title: createRes.body.title, // keep title
            content: 'Updated content for E2E',
            tags: ['e2e', 'updated']
        });
        if (updateRes.status !== 200) {
            console.error('Update failed:', updateRes.status, updateRes.body);
            return;
        }
        console.log('Article updated.');

        // 5. Verify History
        console.log('\n5. Verifying history...');
        const historyRes = await request('GET', `/api/articles/${articleId}/history`);
        if (historyRes.status !== 200) {
            console.error('History fetch failed:', historyRes.status, historyRes.body);
            return;
        }

        console.log(`History entries found: ${historyRes.body.length}`);
        if (historyRes.body.length < 1) {
            console.error('FAIL: Expected history entries.');
        } else {
            // Log first few entries
            historyRes.body.slice(0, 3).forEach(entry => {
                console.log(` - ${entry.message} (by ${entry.author})`);
            });
            console.log('PASS: History retrieved.');
        }

        // 6. Delete Article
        console.log('\n6. Deleting article...');
        const delRes = await request('DELETE', `/api/articles/${articleId}`);
        if (delRes.status !== 200) {
            console.error('Delete failed:', delRes.status, delRes.body);
            return;
        }
        console.log('Article deleted.');

        console.log('\n--- E2E Test Completed Successfully ---');
    } catch (err) {
        console.error('Unexpected error in E2E test:', err);
    }
}

runE2E();
