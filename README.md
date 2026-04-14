# 📚 Team Wiki — Collaborative Documentation Platform

A full-stack collaborative team wiki with **Git-based version control**, **MongoDB-powered search**, and a **modern dark-themed UI**.

---

## ✨ Features

- **Article Management** — Create, edit, delete, and view markdown articles
- **Full-Text Search** — MongoDB text index for fast search across titles and tags
- **Git Version Control** — Automatic commits on every change; view history and restore previous versions
- **Role-Based Access** — Editor and Viewer roles with JWT authentication
- **Auto-Save** — Editor saves every 10 seconds with offline localStorage fallback
- **Markdown Rendering** — Live preview with DOMPurify sanitisation (XSS-safe)
- **Responsive UI** — Glassmorphism dark theme, works on desktop and mobile

---

## 🧠 System Architecture & Core Logic

This project implements several advanced backend engineering concepts to solve complex synchronization and concurrency problems:

1. **Tri-Layer Storage Architecture**: Data writes are orchestrated across three independent layers in strict execution order: **MongoDB** (fast metadata/search) → **File System** (flat `.md` format) → **Git Repository** (version history). Incorporates automatic read-fallback healing if database content drops.
2. **Promise-Based Git Mutex Queue**: Solves NodeJS concurrency execution issues. If multiple users execute saves simultaneously, a Mutex class forces asynchronous Git transactions (`git add`, `git commit`) into safe, sequential promise chains to completely prevent fatal `.git/index.lock` corruption.
3. **Graceful Offline Degradation**: A robust error-boundary catches `fetch` failures. It intercepts unsaved editor documents, serializes them into `localStorage` drafts, and registers a background `window.online` DOM listener to automatically flush and mathematically synchronize the trapped drafts the moment Wi-Fi reconnects.
4. **Synchronous Permission Funnel**: Strict role-based backend authorization utilizing hierarchical Integer Math evaluation (`Viewer=1`, `Editor=2`, `Owner=3`) to deflect all malicious API manipulation, keeping the database perfectly safe regardless of hijacked frontend DOM logic.

---

## 📂 Project Structure

```
MiniProject/
├── server.js                  # Express entry point
├── package.json               # Dependencies & scripts
├── .env                       # Environment variables
├── .gitignore
├── generate_index.sh          # Shell script: Git → index.json
├── articles/                  # Markdown article files (.md)
├── logs/                      # Winston log files
├── public/                    # Frontend (static files)
│   ├── index.html             # Dashboard
│   ├── editor.html            # Create / edit article
│   ├── article.html           # View article
│   ├── history.html           # Version history
│   ├── css/styles.css         # Design system
│   └── js/
│       ├── api.js             # Fetch wrapper with JWT
│       └── app.js             # Page logic & routing
└── server/                    # Backend
    ├── models/
    │   ├── Article.js          # Article schema (Mongoose)
    │   └── User.js             # User schema with bcrypt
    ├── services/
    │   ├── articleService.js    # Business logic
    │   ├── fileService.js       # File system CRUD
    │   └── gitService.js        # Git CLI wrappers
    ├── controllers/
    │   ├── articleController.js # Article route handlers
    │   └── authController.js    # Auth route handlers
    ├── routes/
    │   ├── articleRoutes.js     # Article endpoints
    │   ├── authRoutes.js        # Auth endpoints
    │   └── searchRoutes.js      # Search endpoint
    └── utils/
        ├── logger.js            # Winston logger
        ├── authMiddleware.js    # JWT verify + role check
        └── errorHandler.js      # Global error middleware
```

---

## 🚀 Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (running locally or remote URI)
- **Git** (initialised in project root)

---

## ⚙️ Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Initialise Git (required for version control features)
git init

# 3. Configure environment
#    Edit .env to set your MongoDB URI and JWT secret

# 4. Start the server
npm run dev      # Development (auto-reload with nodemon)
npm start        # Production
```

Open **http://localhost:3000** in your browser.

---

## 🔐 Authentication

1. Click **Login** in the navbar
2. Switch to **Register** to create an account
3. Choose role: **Editor** (full access) or **Viewer** (read-only)
4. JWT token is stored in localStorage and sent with API requests

---

## 📡 API Reference

### Articles

| Method   | Endpoint                       | Auth     | Description            |
|----------|--------------------------------|----------|------------------------|
| `GET`    | `/api/articles`                | No       | List all articles      |
| `GET`    | `/api/articles/:id`            | No       | Get article + content  |
| `POST`   | `/api/articles`                | Editor   | Create article         |
| `PUT`    | `/api/articles/:id`            | Editor   | Update article         |
| `DELETE` | `/api/articles/:id`            | Editor   | Delete article         |

### Search

| Method   | Endpoint                       | Auth     | Description            |
|----------|--------------------------------|----------|------------------------|
| `GET`    | `/api/search?q=keyword`        | No       | Full-text search       |

### Version History

| Method   | Endpoint                       | Auth     | Description            |
|----------|--------------------------------|----------|------------------------|
| `GET`    | `/api/articles/:id/history`    | No       | Git commit log         |
| `POST`   | `/api/articles/:id/restore`    | Editor   | Restore to commit hash |

### Auth

| Method   | Endpoint                       | Rate Limited | Description       |
|----------|--------------------------------|--------------|-------------------|
| `POST`   | `/api/auth/register`           | Yes (10/15m) | Create account    |
| `POST`   | `/api/auth/login`              | Yes (10/15m) | Get JWT token     |

---

## 🧠 Environment Variables

| Variable        | Description              |
|-----------------|--------------------------|
| `PORT`          | Server port              |
| `MONGODB_URI`   | MongoDB connection       |
| `JWT_SECRET`    | JWT signing key          |
| `GIT_AUTO_PUSH` | Push after each commit?  |

---

## 🛠️ Shell Script

```bash
# Generate article index from Git history
bash generate_index.sh
```

Parses `git log` for each `.md` file in `articles/` and writes `articles/index.json`.

---

## 📄 License

MIT
