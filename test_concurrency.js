const http = require('http');

async function makeRequest(data, id) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/articles',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function updateRequest(id, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/api/articles/${id}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function run() {
    // 1. Create Article
    console.log('Creating article...');
    const createRes = await makeRequest({
        title: 'Concurrency Test',
        content: 'Initial content',
        tags: ['test'],
        author: 'tester'
    });
    console.log('Create response:', createRes.status);

    if (createRes.status !== 201) {
        console.error('Failed to create article');
        return;
    }

    const article = JSON.parse(createRes.body);
    const id = article._id;
    console.log('Article ID:', id);

    // 2. Send concurrent updates
    console.log('Sending 5 concurrent updates...');
    const updates = [];
    for (let i = 0; i < 5; i++) {
        updates.push(updateRequest(id, {
            title: `Concurrency Test`,
            content: `Update ${i}`,
            author: `user${i}`
        }));
    }

    const results = await Promise.all(updates);
    console.log('Update statuses:', results.map(r => r.status));
}

run().catch(console.error);
