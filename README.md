# Team Wiki — Collaborative Documentation Platform

A full-stack collaborative team wiki with **Git-based version control**, **MongoDB-powered search**, **role-based access control**, and a **Claymorphism UI design system**.

---

## Features

- **Article Management** — Create, edit, delete, and view markdown articles
- **Full-Text Search** — MongoDB text index for fast search across titles and tags
- **Git Version Control** — Automatic commits on every change; view history and restore previous versions
- **Role-Based Access** — Owner, Editor, and Viewer roles with JWT authentication
- **Restore Request Flow** — Editors can request a version restore; owners approve or decline
- **Invitation System** — Owners can invite collaborators by username or email
- **Auto-Save** — Editor saves every 10 seconds with offline localStorage fallback
- **Markdown Rendering** — Live preview with DOMPurify sanitisation (XSS-safe)
- **Secure Authentication** — bcrypt password hashing, HttpOnly refresh token rotation, email verification, password reset
- **Abuse Protection** — Rate limiting on all endpoints (login, register, API, search, invitations)
- **Responsive UI** — Claymorphism design system with soft shadows, puffy rounded cards, and tactile hover animations. Works on desktop and mobile.

---

## System Architecture & Core Logic

This project implements several advanced backend engineering concepts to solve complex synchronization and concurrency problems:

1. **Tri-Layer Storage Architecture**: Data writes are orchestrated across three independent layers in strict execution order: **MongoDB** (fast metadata/search) → **File System** (flat `.md` format) → **Git Repository** (version history). Incorporates automatic read-fallback healing if database content drops.
2. **Promise-Based Git Mutex Queue**: Solves NodeJS concurrency execution issues. If multiple users execute saves simultaneously, a Mutex class forces asynchronous Git transactions (`git add`, `git commit`) into safe, sequential promise chains to completely prevent fatal `.git/index.lock` corruption.
3. **Graceful Offline Degradation**: A robust error-boundary catches `fetch` failures. It intercepts unsaved editor documents, serializes them into `localStorage` drafts, and registers a background `window.online` DOM listener to automatically flush and synchronize the trapped drafts the moment Wi-Fi reconnects.
4. **Synchronous Permission Funnel**: Strict role-based backend authorization utilizing hierarchical integer evaluation (`Viewer=1`, `Editor=2`, `Owner=3`) to deflect all malicious API manipulation, keeping the database safe regardless of hijacked frontend DOM logic.
5. **Refresh Token Rotation**: On every session refresh, the old refresh token is deleted from the database and replaced with a new cryptographically random token stored in an HttpOnly cookie — preventing token replay attacks.

---

## Project Structure

```
MiniProject/
├── server.js                         # Express entry point
├── package.json                      # Dependencies & scripts
├── .env                              # Environment variables (gitignored)
├── .gitignore
├── articles/                         # Markdown article files (.md)
├── logs/                             # Winston log files (gitignored)
├── public/                           # Frontend (static files)
│   ├── index.html                    # Landing / dashboard redirect
│   ├── dashboard.html                # Main dashboard
│   ├── editor.html                   # Create / edit article
│   ├── article.html                  # View article
│   ├── history.html                  # Version history & restore
│   ├── create.html                   # New article page
│   ├── my-articles.html              # User's own articles
│   ├── search.html                   # Search results
│   ├── shared.html                   # Articles shared with me
│   ├── settings.html                 # User settings
│   ├── login.html                    # Login page
│   ├── register.html                 # Registration page
│   ├── forgot-password.html          # Password reset request
│   ├── reset-password.html           # Password reset form
│   ├── css/
│   │   └── modern-styles.css         # Claymorphism design system
│   └── js/
│       ├── api.js                    # Fetch wrapper with JWT & token refresh
│       └── dashboard.js              # Dashboard logic & notifications
└── server/
    ├── controllers/
    │   ├── articleController.js      # Article route handlers
    │   ├── authController.js         # Auth route handlers
    │   ├── invitationController.js   # Invitation route handlers
    │   └── restoreRequestController.js # Restore request handlers
    ├── middleware/
    │   ├── authMiddleware.js         # JWT verify + active user check
    │   ├── errorHandler.js           # Global error middleware with logging
    │   └── rateLimiters.js           # Centralised rate limiters (6 tiers)
    ├── models/
    │   ├── Article.js                # Article schema (Mongoose)
    │   ├── User.js                   # User schema with bcrypt
    │   ├── Invitation.js             # Invitation schema
    │   ├── RefreshToken.js           # Refresh token rotation schema
    │   └── RestoreRequest.js         # Restore request schema
    ├── routes/
    │   ├── articleRoutes.js          # Article endpoints
    │   ├── authRoutes.js             # Auth endpoints (rate limited)
    │   ├── invitationRoutes.js       # Invitation endpoints
    │   ├── restoreRequestRoutes.js   # Restore request endpoints
    │   └── searchRoutes.js           # Search endpoint
    ├── services/
    │   ├── articleService.js         # Business logic + IDOR ownership checks
    │   ├── fileService.js            # File system CRUD
    │   ├── gitService.js             # Git CLI wrappers + Mutex queue
    │   └── migrationService.js       # DB migration helpers
    └── utils/
        └── logger.js                 # Winston logger (file + console)
```

---

## Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (Atlas or local URI)
- **Git** (initialised in project root)

---

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Initialise Git (required for version control features)
git init

# 3. Configure environment
#    Copy and edit .env with your values (see Environment Variables below)

# 4. Start the server
npm run dev      # Development (auto-reload with nodemon)
npm start        # Production
```

Open **http://localhost:3000** in your browser.

---

## Authentication

1. Click **Register** to create an account — a verification link will be logged to the server console
2. Click the verification link to activate your account
3. **Login** with your credentials — a short-lived access token (1h) is issued along with an HttpOnly refresh cookie (7 days)
4. On password reset, **all active sessions are revoked** across all devices
5. Roles: **Owner** (full control), **Editor** (read + write), **Viewer** (read-only)

---

## Restore Request Flow

| Role | Capability |
|------|-----------|
| **Owner** | Can directly restore any version |
| **Editor** | Can request a restore — owner must approve |
| **Viewer** | Cannot initiate any restore action |

---

## API Reference

### Articles

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/articles` | ✅ Required | 150/15min | List accessible articles |
| `GET` | `/api/articles/:id` | ✅ Required | 150/15min | Get article + content |
| `POST` | `/api/articles` | ✅ Required | 30/15min | Create article |
| `PUT` | `/api/articles/:id` | ✅ Required | 30/15min | Update article |
| `DELETE` | `/api/articles/:id` | ✅ Required | 30/15min | Delete article (owner only) |
| `GET` | `/api/articles/:id/history` | ✅ Required | 150/15min | Git commit log |
| `POST` | `/api/articles/:id/restore` | ✅ Required | 30/15min | Restore to commit (owner only) |
| `POST` | `/api/articles/:id/share` | ✅ Required | 30/15min | Share article (owner only) |
| `DELETE` | `/api/articles/:id/share/:userId` | ✅ Required | 30/15min | Remove access (owner only) |

### Search

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/search?q=keyword` | ✅ Required | 60/15min | Full-text search |

### Auth

| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `POST` | `/api/auth/register` | 10/15min | Create account |
| `POST` | `/api/auth/login` | 5/15min | Login + set HttpOnly refresh cookie |
| `POST` | `/api/auth/refresh` | 150/15min | Rotate access token |
| `POST` | `/api/auth/logout` | 150/15min | Revoke session |
| `GET` | `/api/auth/verify-email?token=` | 150/15min | Verify email address |
| `POST` | `/api/auth/forgot-password` | 5/15min | Request password reset |
| `POST` | `/api/auth/reset-password` | 5/15min | Complete password reset |

### Invitations

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `POST` | `/api/invitations` | ✅ Required | 20/15min | Send invitation (owner only) |
| `GET` | `/api/invitations` | ✅ Required | 150/15min | Get my pending invitations |
| `PUT` | `/api/invitations/:id/accept` | ✅ Required | 150/15min | Accept invitation |
| `PUT` | `/api/invitations/:id/decline` | ✅ Required | 150/15min | Decline invitation |
| `DELETE` | `/api/invitations/:id` | ✅ Required | 150/15min | Cancel invitation (owner only) |

### Restore Requests

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `POST` | `/api/restore-requests` | ✅ Required | 10/hr | Editor sends restore request |
| `GET` | `/api/restore-requests` | ✅ Required | 150/15min | Owner views pending requests |
| `PUT` | `/api/restore-requests/:id/approve` | ✅ Required | 150/15min | Owner approves request |
| `PUT` | `/api/restore-requests/:id/decline` | ✅ Required | 150/15min | Owner declines request |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `MONGODB_URI` | ✅ Yes | MongoDB connection string |
| `JWT_SECRET` | ✅ Yes | JWT signing secret (keep strong & private) |
| `NODE_ENV` | No | Set to `production` to enable HTTPS redirect & secure cookies |
| `GIT_AUTO_PUSH` | No | Set to `true` to push after each article commit |
| `GIT_REMOTE_URL` | No | Git remote URL for auto-push |
| `GIT_AUTHOR_NAME` | No | Author name for git commits |
| `GIT_AUTHOR_EMAIL` | No | Author email for git commits |

> ⚠️ The server will **refuse to start** if `MONGODB_URI` or `JWT_SECRET` are missing.

---

## Security

- Passwords hashed with **bcrypt** (salt rounds: 10)
- Access tokens expire in **1 hour**; refresh tokens expire in **7 days**
- Refresh tokens use **rotation** — old token is invalidated on every use
- Refresh token stored in **HttpOnly, SameSite=Strict cookie** (not localStorage)
- All sessions revoked on password reset
- **IDOR prevention** — every endpoint verifies the authenticated user owns the resource
- No secrets in frontend code — all via `process.env`
- `.env` is gitignored

---

## License

MIT
