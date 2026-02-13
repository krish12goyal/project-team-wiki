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

| Variable        | Default                                  | Description              |
|-----------------|------------------------------------------|--------------------------|
| `PORT`          | `3000`                                   | Server port              |
| `MONGODB_URI`   | `mongodb://localhost:27017/team-wiki`    | MongoDB connection       |
| `JWT_SECRET`    | `change_this_to_a_strong_random_secret`  | JWT signing key          |
| `GIT_AUTO_PUSH` | `false`                                  | Push after each commit?  |

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
