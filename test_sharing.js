const axios = require('axios');
const assert = require('assert');

const API_URL = 'http://localhost:3000/api';
let userA_token, userB_token, userC_token;
let articleId;

async function login(username) {
    try {
        // Register first (idempotent-ish for this test env)
        try {
            await axios.post(`${API_URL}/auth/register`, { username, password: 'password123' });
        } catch (e) { }

        const res = await axios.post(`${API_URL}/auth/login`, { username, password: 'password123' });
        return res.data.token;
    } catch (err) {
        console.error(`Login failed for ${username}:`, err.message);
        process.exit(1);
    }
}

async function runTest() {
    console.log('--- Starting Sharing & Permission Test ---');

    const timestamp = Date.now();
    const userA = `UserA_${timestamp}`;
    const userB = `UserB_${timestamp}`;
    const userC = `UserC_${timestamp}`;

    console.log(`1. Logging in users (${userA}, ${userB}, ${userC})...`);
    userA_token = await login(userA); // Owner
    userB_token = await login(userB); // Receiver
    userC_token = await login(userC); // Unauthorized

    const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

    console.log('2. User A creating article...');
    try {
        const res = await axios.post(`${API_URL}/articles`, {
            title: `Top Secret Plan ${timestamp}`,
            content: 'This is classified.',
            tags: ['secret']
        }, authHeaders(userA_token));
        articleId = res.data._id;
        console.log('   Article created:', articleId);
    } catch (err) {
        console.error('Failed to create article:', err.response?.data || err.message);
        process.exit(1);
    }

    console.log('3. User C (Unauthorized) trying to view...');
    try {
        await axios.get(`${API_URL}/articles/${articleId}`, authHeaders(userC_token));
        console.error('   FAILED: User C was able to view!');
    } catch (err) {
        if (err.response && err.response.status === 403) {
            console.log('   PASSED: User C denied (403)');
        } else {
            console.error('   FAILED: Unexpected error:', err.message);
        }
    }

    console.log(`4. User A sharing with User B (Viewer)...`);
    try {
        await axios.post(`${API_URL}/articles/${articleId}/share`, {
            usernameOrEmail: userB,
            permission: 'viewer'
        }, authHeaders(userA_token));
        console.log('   PASSED: Shared with User B');
    } catch (err) {
        console.error('   FAILED to share:', err.response?.data || err.message);
    }

    console.log('5. User B trying to view (Should Succeed)...');
    try {
        await axios.get(`${API_URL}/articles/${articleId}`, authHeaders(userB_token));
        console.log('   PASSED: User B can view');
    } catch (err) {
        console.error('   FAILED: User B could not view:', err.response?.data || err.message);
    }

    console.log('6. User B trying to edit (Should Fail)...');
    try {
        await axios.put(`${API_URL}/articles/${articleId}`, {
            content: 'Hacked by B'
        }, authHeaders(userB_token));
        console.error('   FAILED: User B was able to edit!');
    } catch (err) {
        if (err.response && err.response.status === 403) {
            console.log('   PASSED: User B denied edit (403)');
        } else {
            console.error('   FAILED: Unexpected error:', err.message);
        }
    }

    console.log('7. User A upgrading User B to Editor...');
    try {
        await axios.post(`${API_URL}/articles/${articleId}/share`, {
            usernameOrEmail: userB,
            permission: 'editor'
        }, authHeaders(userA_token));
        console.log('   PASSED: Upgraded User B to Editor');
    } catch (err) {
        console.error('   FAILED to upgrade:', err.response?.data || err.message);
    }

    console.log('8. User B trying to edit again (Should Succeed)...');
    try {
        await axios.put(`${API_URL}/articles/${articleId}`, {
            content: 'Collaborative edit by B',
            title: 'Top Secret Plan (Edited)'
        }, authHeaders(userB_token));
        console.log('   PASSED: User B can edit');
    } catch (err) {
        console.error('   FAILED: User B could not edit:', err.response?.data || err.message);
    }

    console.log('9. User A removing access for User B...');
    try {
        // Need User B's ID first
        const art = await axios.get(`${API_URL}/articles/${articleId}`, authHeaders(userA_token));
        const userBId = art.data.sharedWith.find(s => s.user.username === userB).user._id;

        await axios.delete(`${API_URL}/articles/${articleId}/share/${userBId}`, authHeaders(userA_token));
        console.log('   PASSED: Removed access for User B');
    } catch (err) {
        console.error('   FAILED to remove access:', err.message);
    }

    console.log('10. User B trying to view again (Should Fail)...');
    try {
        await axios.get(`${API_URL}/articles/${articleId}`, authHeaders(userB_token));
        console.error('   FAILED: User B still has access!');
    } catch (err) {
        if (err.response && err.response.status === 403) {
            console.log('   PASSED: User B denied (403)');
        } else {
            console.error('   FAILED: Unexpected error:', err.message);
        }
    }

    console.log('--- Test Complete ---');
}

runTest();
