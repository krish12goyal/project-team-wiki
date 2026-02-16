/**
 * API Client Module
 * Centralised fetch wrapper with JWT auth header injection.
 */

const API_BASE = '/api';

/**
 * Get the stored JWT token.
 */
function getToken() {
    return localStorage.getItem('wiki_token');
}

/**
 * Get the current user object.
 */
function getUser() {
    const data = localStorage.getItem('wiki_user');
    return data ? JSON.parse(data) : null;
}

/**
 * Save auth data after login/register.
 */
function saveAuth(token, user) {
    localStorage.setItem('wiki_token', token);
    localStorage.setItem('wiki_user', JSON.stringify(user));
}

/**
 * Clear auth data on logout.
 */
function clearAuth() {
    localStorage.removeItem('wiki_token');
    localStorage.removeItem('wiki_user');
}

/**
 * Make an authenticated API request.
 * @param {string} endpoint - API path (e.g. '/articles')
 * @param {Object} options - fetch options
 * @returns {Promise<Object>} parsed JSON response
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    console.log(`[API] Fetching: ${url}`, options.method || 'GET');
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const response = await fetch(url, {
        ...options,
        headers,
    });
    console.log(`[API] Response: ${url}`, response.status);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
}

// ---------- Article API ----------

async function getArticles(tag) {
    const query = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return apiRequest(`/articles${query}`);
}

async function getArticle(id) {
    return apiRequest(`/articles/${id}`);
}

async function createArticle(data) {
    return apiRequest('/articles', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

async function updateArticle(id, data) {
    return apiRequest(`/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

async function deleteArticle(id) {
    return apiRequest(`/articles/${id}`, { method: 'DELETE' });
}

async function searchArticles(query) {
    return apiRequest(`/search?q=${encodeURIComponent(query)}`);
}

async function getArticleHistory(id) {
    return apiRequest(`/articles/${id}/history`);
}

async function restoreArticle(id, commitHash) {
    return apiRequest(`/articles/${id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ commitHash }),
    });
}

async function shareArticle(id, usernameOrEmail, permission) {
    return apiRequest(`/articles/${id}/share`, {
        method: 'POST',
        body: JSON.stringify({ usernameOrEmail, permission }),
    });
}

async function removeAccess(articleId, userId) {
    return apiRequest(`/articles/${articleId}/share/${userId}`, {
        method: 'DELETE',
    });
}

// ---------- Auth API ----------

async function register(username, password, role, email) {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, role, email }),
    });
}

async function login(username, password) {
    return apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

// Export to global scope for vanilla JS usage
window.WikiAPI = {
    getToken, getUser, saveAuth, clearAuth,
    getArticles, getArticle, createArticle, updateArticle, deleteArticle,
    searchArticles, getArticleHistory, restoreArticle,
    shareArticle, removeAccess,
    register, login,
};
