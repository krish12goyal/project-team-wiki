# The Tri-Layer Storage Synchronization Architecture

The Team Wiki does not rely on a single source of truth. Instead, it carefully orchestrates data across three distinct storage mechanisms.

## The Three Pillars

1. **MongoDB (The Fast Metadata Layer)**
   - **What it stores**: Fast queryable metadata (Owner ID, Shared permissions array, Timestamps, Titles, Tags, and Author strings). It also stores the full Markdown text in the `content` field.
   - **Why it’s used**: Provides rapid full-text search (`$text` index), relational data (mapping User IDs to document permissions), and serves as the primary API data source.

2. **File System (The Flat File Layer)**
   - **What it stores**: Raw `.md` files residing in the `articles/<slug>.md` path on the server's hard drive.
   - **Why it’s used**: Serves as the actual target for Git version control. Git excels at tracking flat text files, not NoSQL databases. Furthermore, if MongoDB drops the content, it acts as a fallback store.

3. **Local Git Repository (The Temporal Layer)**
   - **What it stores**: Commit history of the `articles/` directory.
   - **Why it’s used**: It provides out-of-the-box, extremely robust Diffs, History traversal, and Restoration mapping.

---

## The Synchronization Flow

When an update occurs (e.g., `updateArticle` in `articleService.js`), the layers must sync reliably without breaking. The code performs a specific orchestration:

### 1. Database Write (First Priority)
```javascript
article.title = data.title;
article.content = data.content;
await article.save();
```
The MongoDB write happens first. If this fails (e.g., validation error, database down), the entire request aborts cleanly with a 500 or 400 status code. No files are harmed.

### 2. Disk Write (Second Priority)
```javascript
await fileService.writeArticle(article.slug, data.content);
```
Once the database confirms the save, Node.js overwrites the exact flat file. 
*Vulnerability point: If the network drops or the Node process crashes exactly here, MongoDB has the data, but the file system does not.*

### 3. Git Auto-Commit (Fire and Forget)
```javascript
await safeAutoCommit(`[${authorName}] Updated article: ${article.title}`);
```
The system calls `safeAutoCommit`, which performs `git add .` and `git commit`. 
Notice this is a "fire-and-forget" mechanism. The `safeAutoCommit` function catches its own errors and **only logs them**, it never throws them back to the API.
If Git is broken, locked, or corrupted, the user still receives a `200 OK` network response because their data is safe in MongoDB, preventing frontend UX failure over a purely auditing mechanism.

## Handling Desync: The Fallback Mechanism
If the File System gets out of sync with MongoDB (for instance, an old legacy article where MongoDB `content` is empty):

```javascript
// From articleService.js: getArticleById()
let content = article.content || '';
if (!content) {
    // Fallback to file system if content is empty in DB
    content = await fileService.readArticle(article.slug);
}
```
The architecture inherently treats MongoDB as the primary reader, but self-heals visual data reading by fetching from the disk if the DB payload is empty.
