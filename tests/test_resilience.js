const http = require('http');

const PORT = 3000;

function request(method, path, data = null) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', (e) => resolve({ status: 500, error: e.message }));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testResilience() {
    console.log('--- Testing Resilience (Simulated Failure) ---');

    // 1. Create Article (Should succeed in DB, fail in Git Push)
    console.log('1. Creating article...');
    const res = await request('POST', '/api/articles', {
        title: 'Resilience Test',
        content: 'Content that should be saved despite git failure.',
        tags: ['resilience'],
        author: 'tester'
    });

    console.log('Response Status:', res.status);
    console.log('Response Body:', res.body);

    if (res.status === 201) {
        console.log('PASS: Article created/saved despite Git failure.');
    } else {
        console.log('FAIL: Request failed.');
    }

    // 2. Check Server Health
    console.log('\n2. Checking Server Health...');
    try {
        const healthRes = await request('GET', '/api/articles');
        if (healthRes.status === 200) {
            console.log('PASS: Server is still responsive.');
        } else {
            console.log('FAIL: Server crashed or unresponsive. Status:', healthRes.status, 'Error:', healthRes.error || healthRes.body);
        }
    } catch (err) {
        console.log('FAIL: Health check exception:', err);
    }
}

testResilience();
