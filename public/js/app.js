/**
 * App Module
 * Page-specific logic with router-style init based on current pathname.
 * Handles: dashboard, editor, article view, history, auth UI, and offline sync.
 */

// ---------- Utility Helpers ----------

/** Show a toast notification */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

/** Format a date string nicely */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Get URL query parameter */
function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

/** Sanitise HTML via DOMPurify or basic fallback */
function sanitizeHTML(html) {
    if (window.DOMPurify) {
        return DOMPurify.sanitize(html);
    }
    // Basic fallback: strip script tags
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/** Render markdown to sanitised HTML */
function renderMarkdown(md) {
    if (window.marked) {
        const raw = marked.parse(md || '');
        return sanitizeHTML(raw);
    }
    return sanitizeHTML(md || '');
}

// ---------- Auth UI ----------

function updateNavAuth() {
    const user = WikiAPI.getUser();
    const authArea = document.getElementById('auth-area');
    if (!authArea) return;

    if (user) {
        authArea.innerHTML = `
      <span class="navbar__username">${user.username}</span>
      <button class="btn btn--sm btn--secondary" id="logout-btn">Logout</button>
    `;
        document.getElementById('logout-btn').addEventListener('click', () => {
            WikiAPI.clearAuth();
            showToast('Logged out', 'info');
            updateNavAuth();
            // Reload current page to reflect auth state
            if (typeof loadPage === 'function') loadPage();
        });
    } else {
        authArea.innerHTML = `
      <button class="btn btn--sm btn--primary" id="show-login-btn">Login</button>
    `;
        document.getElementById('show-login-btn').addEventListener('click', showAuthModal);
    }
}

function showAuthModal() {
    const overlay = document.getElementById('auth-modal');
    if (overlay) overlay.classList.add('active');
}

function hideAuthModal() {
    const overlay = document.getElementById('auth-modal');
    if (overlay) overlay.classList.remove('active');
}

function initAuthModal() {
    const overlay = document.getElementById('auth-modal');
    if (!overlay) return;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideAuthModal();
    });

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    // Login submit
    const loginSubmit = document.getElementById('login-submit');
    if (loginSubmit) {
        loginSubmit.addEventListener('click', async () => {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            if (!username || !password) return showToast('Fill in all fields', 'error');
            try {
                const data = await WikiAPI.login(username, password);
                WikiAPI.saveAuth(data.token, data.user);
                hideAuthModal();
                showToast(`Welcome back, ${data.user.username}!`, 'success');
                updateNavAuth();
                if (typeof loadPage === 'function') loadPage();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // Register submit
    const regSubmit = document.getElementById('register-submit');
    if (regSubmit) {
        regSubmit.addEventListener('click', async () => {
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;
            if (!username || !password) return showToast('Fill in all fields', 'error');
            try {
                const data = await WikiAPI.register(username, password);
                WikiAPI.saveAuth(data.token, data.user);
                hideAuthModal();
                showToast(`Account created. Welcome, ${data.user.username}!`, 'success');
                updateNavAuth();
                if (typeof loadPage === 'function') loadPage();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }
}

// ---------- Share UI ----------

async function initShareModal(articleId) {
    const modal = document.getElementById('share-modal');
    const listEl = document.getElementById('share-list');
    const addBtn = document.getElementById('share-add-btn');
    const usernameInput = document.getElementById('share-username');
    const permissionSelect = document.getElementById('share-permission');

    if (!modal) return;

    modal.classList.add('active');
    loadShareList();

    async function loadShareList() {
        listEl.innerHTML = '<div class="skeleton" style="height:32px"></div>';
        try {
            // We reload article to get fresh sharedWith list
            // Optimization: Could have a dedicated endpoint, but getArticle works
            const article = await WikiAPI.getArticle(articleId);
            renderList(article.sharedWith || [], article.owner);
        } catch (err) {
            listEl.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
        }
    }

    function renderList(sharedWith, ownerId) {
        let html = '';
        // We logic this client-side for now, but ideally backend populates usernames
        // The service layer *does* populate sharedWith.user, so we expect objects

        if (!sharedWith.length) {
            html = '<p class="text-muted">No one else has access.</p>';
        } else {
            html = sharedWith.map(entry => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border)">
                    <div>
                        <strong>${entry.user ? entry.user.username : 'Unknown'}</strong>
                        <span class="tag" style="margin-left:8px">${entry.permission}</span>
                    </div>
                    <button class="btn btn--danger btn--sm" onclick="handleRemoveAccess('${articleId}', '${entry.user._id}')">Remove</button>
                </div>
            `).join('');
        }
        listEl.innerHTML = html;
    }

    // Remove old listener to prevent duplicates (simple hack)
    const newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);

    newBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const permission = permissionSelect.value;
        if (!username) return showToast('Enter a username', 'error');

        try {
            const res = await WikiAPI.shareArticle(articleId, username, permission);
            showToast('User added', 'success');
            usernameInput.value = '';
            // Update list from response
            renderList(res.sharedWith);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Global handler for remove access
window.handleRemoveAccess = async (articleId, userId) => {
    if (!confirm('Remove access for this user?')) return;
    try {
        const res = await WikiAPI.removeAccess(articleId, userId);
        showToast('Access removed', 'success');
        // Re-render based on response
        // Quickest way is to reload the list from the modal context, 
        // but here we might need to rely on the response or reload the modal
        // For simplicity, let's close and reopen or just reload page? 
        // Better: Find the list element and update it.
        // We'll trust the response returns the updated list.
        const listEl = document.getElementById('share-list');
        if (listEl && res.sharedWith) {
            let html = '';
            if (!res.sharedWith.length) {
                html = '<p class="text-muted">No one else has access.</p>';
            } else {
                html = res.sharedWith.map(entry => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border)">
                        <div>
                            <strong>${entry.user ? entry.user.username : 'Unknown'}</strong>
                            <span class="tag" style="margin-left:8px">${entry.permission}</span>
                        </div>
                        <button class="btn btn--danger btn--sm" onclick="handleRemoveAccess('${articleId}', '${entry.user._id}')">Remove</button>
                    </div>
                `).join('');
            }
            listEl.innerHTML = html;
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ---------- Offline Support ----------

function saveOfflineDraft(articleId, data) {
    const drafts = JSON.parse(localStorage.getItem('wiki_drafts') || '{}');
    drafts[articleId || '__new__'] = { ...data, savedAt: Date.now() };
    localStorage.setItem('wiki_drafts', JSON.stringify(drafts));
}

function getOfflineDraft(articleId) {
    const drafts = JSON.parse(localStorage.getItem('wiki_drafts') || '{}');
    return drafts[articleId || '__new__'] || null;
}

function clearOfflineDraft(articleId) {
    const drafts = JSON.parse(localStorage.getItem('wiki_drafts') || '{}');
    delete drafts[articleId || '__new__'];
    localStorage.setItem('wiki_drafts', JSON.stringify(drafts));
}

async function syncOfflineDrafts() {
    const drafts = JSON.parse(localStorage.getItem('wiki_drafts') || '{}');
    for (const [key, draft] of Object.entries(drafts)) {
        try {
            if (key === '__new__') {
                await WikiAPI.createArticle(draft);
            } else {
                await WikiAPI.updateArticle(key, draft);
            }
            delete drafts[key];
            showToast('Offline draft synced', 'success');
        } catch {
            // Will retry on next online event
        }
    }
    localStorage.setItem('wiki_drafts', JSON.stringify(drafts));
}

// Listen for online event to sync drafts
window.addEventListener('online', syncOfflineDrafts);

// ---------- Page: Dashboard (index.html) ----------

async function initDashboard() {
    const grid = document.getElementById('article-grid');
    const searchInput = document.getElementById('search-input');
    if (!grid) return;

    async function loadArticles(query) {
        grid.innerHTML = '<div class="skeleton" style="height:120px"></div>'.repeat(3);
        try {
            const articles = query
                ? await WikiAPI.searchArticles(query)
                : await WikiAPI.getArticles();

            if (!articles.length) {
                grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-state__icon">📝</div>
            <div class="empty-state__title">No articles yet</div>
            <p>Create your first article to get started.</p>
          </div>`;
                return;
            }

            grid.innerHTML = articles.map((a) => `
        <a href="/article?id=${a._id}" class="card" style="text-decoration:none;color:inherit">
          <div class="card__title">${a.title}</div>
          <div class="card__meta">
            <span>✍️ ${a.author}</span>
            <span>🕒 ${formatDate(a.updatedAt)}</span>
          </div>
          ${a.tags && a.tags.length ? `
            <div class="card__tags">
              ${a.tags.map((t) => `<span class="tag">${t}</span>`).join('')}
            </div>` : ''}
        </a>
      `).join('');
        } catch (err) {
            grid.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
        }
    }

    // Search with debounce
    let debounce;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => loadArticles(searchInput.value.trim()), 300);
        });
    }

    window.loadPage = () => loadArticles('');
    loadArticles('');
}

// ---------- Page: Editor (editor.html) ----------

async function initEditor() {
    const form = document.getElementById('editor-form');
    const titleInput = document.getElementById('editor-title');
    const contentInput = document.getElementById('editor-content');
    const tagsInput = document.getElementById('editor-tags');
    const previewDiv = document.getElementById('editor-preview');
    const saveBtn = document.getElementById('editor-save');
    const statusBar = document.getElementById('status-bar');
    if (!form) return;

    const articleId = getParam('id');
    let lastSavedContent = '';
    let autoSaveTimer = null;

    // Load existing article if editing
    if (articleId) {
        try {
            const article = await WikiAPI.getArticle(articleId);
            titleInput.value = article.title || '';
            contentInput.value = article.content || '';
            tagsInput.value = (article.tags || []).join(', ');
            lastSavedContent = article.content || '';
            updatePreview();
        } catch (err) {
            // Check for offline draft
            const draft = getOfflineDraft(articleId);
            if (draft) {
                titleInput.value = draft.title || '';
                contentInput.value = draft.content || '';
                tagsInput.value = (draft.tags || []).join(', ');
                showToast('Loaded from offline draft', 'info');
            } else {
                showToast('Failed to load article: ' + err.message, 'error');
            }
        }
    } else {
        // Check for new article draft
        const draft = getOfflineDraft(null);
        if (draft) {
            titleInput.value = draft.title || '';
            contentInput.value = draft.content || '';
            tagsInput.value = (draft.tags || []).join(', ');
            showToast('Restored offline draft', 'info');
        }
    }

    // Live markdown preview
    function updatePreview() {
        if (previewDiv) {
            previewDiv.innerHTML = renderMarkdown(contentInput.value);
        }
    }

    contentInput.addEventListener('input', updatePreview);

    // Auto-save every 10 seconds
    function updateStatus(text, state) {
        if (statusBar) {
            statusBar.innerHTML = `<span class="status-bar__dot status-bar__dot--${state}"></span>${text}`;
        }
    }

    async function autoSave() {
        if (contentInput.value === lastSavedContent && articleId) return;

        const data = {
            title: titleInput.value.trim(),
            content: contentInput.value,
            tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
        };

        if (!data.title) return;

        updateStatus('Saving…', 'saving');

        try {
            if (navigator.onLine) {
                if (articleId) {
                    await WikiAPI.updateArticle(articleId, data);
                }
                // Don't auto-create new articles — only save as draft
                else {
                    saveOfflineDraft(null, data);
                }
                lastSavedContent = data.content;
                updateStatus('Saved', 'saved');
            } else {
                saveOfflineDraft(articleId, data);
                updateStatus('Saved offline', 'offline');
            }
        } catch {
            saveOfflineDraft(articleId, data);
            updateStatus('Saved offline', 'offline');
        }
    }

    autoSaveTimer = setInterval(autoSave, 10000);

    // Manual save / create
    saveBtn.addEventListener('click', async () => {
        const data = {
            title: titleInput.value.trim(),
            content: contentInput.value,
            tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
        };

        if (!data.title) return showToast('Title is required', 'error');

        try {
            if (articleId) {
                await WikiAPI.updateArticle(articleId, data);
                showToast('Article updated', 'success');
                lastSavedContent = data.content;
                clearOfflineDraft(articleId);
            } else {
                const created = await WikiAPI.createArticle(data);
                showToast('Article created', 'success');
                clearOfflineDraft(null);
                // Redirect to the new article
                window.location.href = `/article?id=${created._id}`;
                return;
            }
            updateStatus('Saved', 'saved');
        } catch (err) {
            showToast(err.message, 'error');
            saveOfflineDraft(articleId, data);
            updateStatus('Saved offline', 'offline');
        }
    });

    // Cleanup on leave
    window.addEventListener('beforeunload', () => clearInterval(autoSaveTimer));
    updatePreview();
}

// ---------- Page: Article View (article.html) ----------

async function initArticleView() {
    const contentDiv = document.getElementById('article-body');
    const titleEl = document.getElementById('article-title');
    const metaEl = document.getElementById('article-meta');
    const tagsEl = document.getElementById('article-tags');
    const actionsEl = document.getElementById('article-actions');
    if (!contentDiv) return;

    const articleId = getParam('id');
    if (!articleId) {
        contentDiv.innerHTML = '<p>No article ID provided.</p>';
        return;
    }

    try {
        const article = await WikiAPI.getArticle(articleId);

        titleEl.textContent = article.title;
        metaEl.innerHTML = `
      <span>✍️ ${article.author}</span>
      <span>🕒 Updated: ${formatDate(article.updatedAt)}</span>
      <span>📅 Created: ${formatDate(article.createdAt)}</span>
    `;

        if (article.tags && article.tags.length) {
            tagsEl.innerHTML = article.tags.map((t) => `<span class="tag">${t}</span>`).join('');
        }

        contentDiv.innerHTML = renderMarkdown(article.content);

        // Render buttons based on computed permission
        const myPerm = article.currentUserPermission || 'viewer'; // 'viewer', 'editor', 'owner'

        let buttonsHtml = `<a href="/history?id=${article._id}" class="btn btn--secondary btn--sm">🕒 History</a>`;

        if (myPerm === 'editor' || myPerm === 'owner') {
            buttonsHtml = `
                <a href="/editor?id=${article._id}" class="btn btn--primary btn--sm">✏️ Edit</a>
                ${buttonsHtml}
             `;
        }

        if (myPerm === 'owner') {
            buttonsHtml += `
                <button class="btn btn--secondary btn--sm" id="share-btn">🔗 Share</button>
                <button class="btn btn--danger btn--sm" id="delete-btn">🗑️ Delete</button>
            `;
        }

        actionsEl.innerHTML = buttonsHtml;

        // Attach listeners
        if (myPerm === 'owner') {
            document.getElementById('share-btn').addEventListener('click', () => initShareModal(articleId));
            document.getElementById('delete-btn').addEventListener('click', async () => {
                if (!confirm('Delete this article permanently?')) return;
                try {
                    await WikiAPI.deleteArticle(articleId);
                    showToast('Article deleted', 'success');
                    window.location.href = '/';
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        window.loadPage = () => initArticleView();
    } catch (err) {
        contentDiv.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    }
}

// ---------- Page: History (history.html) ----------

async function initHistory() {
    const timeline = document.getElementById('history-timeline');
    const titleEl = document.getElementById('history-title');
    if (!timeline) return;

    const articleId = getParam('id');
    if (!articleId) {
        timeline.innerHTML = '<p>No article ID provided.</p>';
        return;
    }

    try {
        // Load article title
        const article = await WikiAPI.getArticle(articleId);
        if (titleEl) titleEl.textContent = `History: ${article.title}`;

        const history = await WikiAPI.getArticleHistory(articleId);

        if (!history.length) {
            timeline.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📜</div>
          <div class="empty-state__title">No history yet</div>
          <p>Edit the article to create version history.</p>
        </div>`;
            return;
        }

        const isEditor = article && (article.currentUserPermission === 'editor' || article.currentUserPermission === 'owner');

        timeline.innerHTML = history.map((entry) => `
      <div class="timeline__item">
        <span class="timeline__hash">${entry.hash ? entry.hash.substring(0, 7) : ''}</span>
        <div class="timeline__message">${entry.message || 'No message'}</div>
        <div class="timeline__date">${formatDate(entry.date)} · ${entry.author || 'unknown'}</div>
        ${isEditor ? `<button class="btn btn--sm btn--secondary mt-1" onclick="handleRestore('${articleId}', '${entry.hash}')">↩️ Restore</button>` : ''}
      </div>
    `).join('');

    } catch (err) {
        timeline.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    }
}

// Global restore handler (called from inline onclick)
async function handleRestore(articleId, commitHash) {
    if (!confirm('Restore to this version? Current content will be replaced.')) return;
    try {
        await WikiAPI.restoreArticle(articleId, commitHash);
        showToast('Article restored successfully', 'success');
        window.location.href = `/article?id=${articleId}`;
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------- Router ----------

document.addEventListener('DOMContentLoaded', () => {
    updateNavAuth();
    initAuthModal();

    const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';

    switch (path) {
        case '/':
        case '/index':
            initDashboard();
            break;
        case '/editor':
            initEditor();
            break;
        case '/article':
            initArticleView();
            break;
        case '/history':
            initHistory();
            break;
    }
});
