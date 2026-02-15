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
    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (userNameEl) {
        const displayName = user.name || user.username || user.email || 'User';
        userNameEl.textContent = displayName;
    }
    
    if (userRoleEl) {
        const role = user.role || 'Editor';
        userRoleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    }
    
    if (userAvatarEl) {
        const name = user.name || user.username || user.email || 'U';
        userAvatarEl.textContent = name.charAt(0).toUpperCase();
    }
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }
    
    // Logout functionality
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
    
    // Set active navigation link
    setActiveNavLink();
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
