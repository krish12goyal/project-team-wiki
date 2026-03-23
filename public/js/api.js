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
async function apiRequest(endpoint, options = {}, _isRetry = false) {
    const url = `${API_BASE}${endpoint}`;
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

    // If 401 and we haven't already retried, try to refresh the token
    if (response.status === 401 && !_isRetry && token) {
        const refreshed = await _tryRefreshToken(token);
        if (refreshed) {
            // Retry the original request with the new token
            return apiRequest(endpoint, options, true);
        }
        // Refresh failed — redirect to login
        clearAuth();
        window.location.href = '/login.html';
        throw new Error('Session expired. Redirecting to login...');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
}

/**
 * Attempt to refresh an expired JWT token.
 * @param {string} expiredToken - The expired token
 * @returns {Promise<boolean>} true if refresh succeeded
 */
async function _tryRefreshToken(expiredToken) {
    try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${expiredToken}`,
            },
        });

        if (!response.ok) return false;

        const data = await response.json();
        if (data.token && data.user) {
            saveAuth(data.token, data.user);
            return true;
        }
        return false;
    } catch (err) {
        console.warn('[API] Token refresh failed:', err.message);
        return false;
    }
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
