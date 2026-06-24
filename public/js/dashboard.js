/**
 * Dashboard Module
 * Handles sidebar navigation, user authentication state, and shared functionality
 */

// Check authentication on protected pages
function checkAuth() {
    const user = WikiAPI.getUser();
    const token = WikiAPI.getToken();
    
    // List of protected pages
    const protectedPages = ['/dashboard.html', '/my-articles.html', '/shared.html', 
                          '/create.html', '/editor.html', '/article.html', 
                          '/history.html', '/search.html', '/settings.html'];
    
    const currentPage = window.location.pathname;
    const isProtected = protectedPages.some(page => currentPage.includes(page) || currentPage === page);
    
    if (isProtected && (!user || !token)) {
        window.location.href = '/login.html';
        return false;
    }
    
    return true;
}

// Initialize sidebar navigation
function initSidebar() {
    const user = WikiAPI.getUser();
    if (!user) return;
    
    // Update user info in sidebar
    updateSidebarUserInfo(user);
    
    const sidebar = document.getElementById('sidebar');
    
    if (sidebar) {
        // Sidebar info and other init
    }

    // Initialize Mobile Drawer (Independent)
    initMobileDrawer();
    
    // Logout functionality
    initLogout();
    
    // Set active navigation link
    setActiveNavLink();
}

function updateSidebarUserInfo(user) {
    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (userNameEl) {
        const displayName = user.name || user.username || user.email || 'User';
        userNameEl.textContent = displayName;
    }
    
    if (userRoleEl) {
        userRoleEl.textContent = 'Team Member';
    }
    
    if (userAvatarEl) {
        const name = user.name || user.username || user.email || 'U';
        userAvatarEl.textContent = name.charAt(0).toUpperCase();
    }
}

function initMobileDrawer() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (mobileMenuBtn && sidebar && sidebarOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });
        
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });

        // Close when clicking a nav link on mobile
        sidebar.querySelectorAll('.sidebar__link').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('open');
                    sidebarOverlay.classList.remove('active');
                }
            });
        });
    }
}

function initLogout() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                WikiAPI.clearAuth();
                localStorage.removeItem('wiki_user_name');
                window.location.href = '/login.html';
            }
        });
    }
}

// Set active navigation link based on current page
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.sidebar__link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        
        if (href && currentPath.includes(href.replace('.html', ''))) {
            link.classList.add('active');
        }
    });
}

// Initialize dashboard page
function initDashboard() {
    if (!checkAuth()) return;
    
    // Any dashboard-specific initialization
    initNotificationBell();
}

// Show toast notification
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
    
    setTimeout(() => toast.remove(), 4500);
}

// Format date nicely
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get user role badge class
function getRoleBadgeClass(role) {
    switch (role?.toLowerCase()) {
        case 'owner':
            return 'badge--owner';
        case 'editor':
            return 'badge--editor';
        case 'viewer':
            return 'badge--viewer';
        default:
            return 'badge--viewer';
    }
}

// Get user role for article
function getUserRoleForArticle(article, user) {
    if (!article || !user) return 'Viewer';
    
    // Check if owner
    if (article.owner === user.id || article.author === user.username) {
        return 'Owner';
    }
    
    // Check shared permissions
    if (article.sharedWith) {
        const share = article.sharedWith.find(s => 
            s.user === user.id || s.user?._id === user.id
        );
        if (share) {
            return share.permission === 'editor' ? 'Editor' : 'Viewer';
        }
    }
    
    // Check currentUserPermission from API
    if (article.currentUserPermission) {
        return article.currentUserPermission === 'editor' ? 'Editor' : 'Viewer';
    }
    
    return 'Viewer';
}

// ---------- Notification Bell ---------- //

function initNotificationBell() {
    // Only show if logged in
    const token = WikiAPI.getToken();
    if (!token) return;

    // Prevent duplicate injection
    if (document.getElementById('notif-container')) return;

    // Inject bell HTML into the body
    const bellHtml = `
        <div class="notif-bell-container" id="notif-container">
            <div class="notif-bell" id="notif-bell-btn">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
                <div class="notif-badge" id="notif-badge">0</div>
            </div>
            
            <div class="notif-panel" id="notif-panel">
                <div class="notif-panel__header">
                    <div class="notif-panel__title">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                        Pending Invitations
                    </div>
                </div>
                <div class="notif-panel__content" id="notif-content">
                    <div class="notif-empty">
                        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity: 0.5;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                        </svg>
                        No pending invitations
                    </div>
                </div>
            </div>
        </div>
    `;
    const headerRight = document.querySelector('.top-header__right');
    if (headerRight) {
        headerRight.insertAdjacentHTML('afterbegin', bellHtml);
    } else {
        document.body.insertAdjacentHTML('beforeend', bellHtml);
    }

    const bellBtn = document.getElementById('notif-bell-btn');
    const panel = document.getElementById('notif-panel');

    // Toggle panel
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) {
            fetchInvitations();
        }
    });

    // Close panel on outside click
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !bellBtn.contains(e.target)) {
            panel.classList.remove('active');
        }
    });

    // Initial fetch and poll every 30s
    fetchInvitations();
    setInterval(fetchInvitations, 30000);
}

async function fetchInvitations() {
    try {
        if (!WikiAPI.getMyInvitations) return;
        const invites = await WikiAPI.getMyInvitations();
        renderInvitations(invites);
    } catch (err) {
        console.error('Failed to fetch invitations:', err);
    }
}

function renderInvitations(invites) {
    const badge = document.getElementById('notif-badge');
    const content = document.getElementById('notif-content');
    
    if (!badge || !content) return;

    // Update Badge
    if (invites.length > 0) {
        badge.textContent = invites.length;
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }

    // Update Panel Content
    if (invites.length === 0) {
        content.innerHTML = `
            <div class="notif-empty">
                <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity: 0.5;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                No pending invitations
            </div>
        `;
        return;
    }

    content.innerHTML = invites.map(inv => `
        <div class="notif-card" id="invite-${inv._id}">
            <div class="notif-card__title">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="text-primary-500">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                ${escapeHtml(inv.article?.title || 'Unknown Article')}
            </div>
            <div class="notif-card__text">
                <strong>${escapeHtml(inv.fromUser?.username || 'Unknown')}</strong> invited you as 
                <span class="badge ${inv.permission === 'editor' ? 'badge--editor' : 'badge--viewer'}">${inv.permission}</span>
            </div>
            <div class="notif-card__actions">
                <button class="btn btn--secondary btn--sm" onclick="handleInvitation('${inv._id}', 'decline')" style="flex: 1;">Decline</button>
                <button class="btn btn--primary btn--sm" onclick="handleInvitation('${inv._id}', 'accept')" style="flex: 1;">Accept</button>
            </div>
        </div>
    `).join('');
}

window.handleInvitation = async function(id, action) {
    try {
        const card = document.getElementById(`invite-${id}`);
        if (card) {
            const btns = card.querySelectorAll('button');
            btns.forEach(b => { b.disabled = true; b.textContent = '...'; });
        }

        if (action === 'accept') {
            await WikiAPI.acceptInvitation(id);
            showToast('Invitation accepted!', 'success');
            // If they are on dashboard/shared page, refresh the list if needed
            if (window.loadArticles && (window.location.pathname.includes('dashboard') || window.location.pathname.includes('shared'))) {
                window.loadArticles();
            }
        } else {
            await WikiAPI.declineInvitation(id);
            showToast('Invitation declined', 'info');
        }

        // Re-fetch remaining invites to update badge and panel
        fetchInvitations();
    } catch (err) {
        showToast(err.message || 'Failed to process invitation', 'error');
        fetchInvitations(); // Restore state
    }
};

// Export functions globally
window.initSidebar = initSidebar;
window.initDashboard = initDashboard;
window.checkAuth = checkAuth;
window.showToast = showToast;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
window.getRoleBadgeClass = getRoleBadgeClass;
window.getUserRoleForArticle = getUserRoleForArticle;
window.initNotificationBell = initNotificationBell;
