# Viva / Interview Questions: Permission & Sharing Engine

## Basic Level
1. **Q:** What two fields in the MongoDB `Article` schema govern access control?
   * **A:** `owner` (an ObjectId) and `sharedWith` (an array of user ObjectIds mapping to specific roles).
2. **Q:** What are the three main role levels in the system for an article?
   * **A:** Viewer, Editor, and Owner.
3. **Q:** How does the frontend know whether to show the "Edit" or "Delete" buttons?
   * **A:** The backend calculates the permission level on the fly and sends a custom `currentPermission` string inside the article JSON payload. The frontend UI conditionally renders buttons based on this.

## Intermediate Level
4. **Q:** What is the `checkPermission` funnel?
   * **A:** It is a single, centralized synchronous function on the backend that evaluates access before any read, write, or delete action occurs. Every protected API route funnels through it to prevent bypassed security.
5. **Q:** If a clever user hides the "Delete" button via frontend CSS, but manually sends a DELETE HTTP request to `/api/articles/123`, what happens?
   * **A:** The `checkPermission` funnel intercepts the route. It checks the user's ID against the database `owner` field. If they are not the owner, it instantly aborts the request and returns an HTTP 403 Forbidden status, keeping the data safe.

## Advanced Level
6. **Q:** Explain how hierarchical math is used to calculate permissions in this system.
   * **A:** The `checkPermission` function converts string roles into integers (e.g., `viewer = 1`, `editor = 2`, `owner = 3`). When an action requires a certain role (like updating requires `editor` / `2`), the system checks if the user's integer role is `>=` the required integer.
7. **Q:** Does the `sharedWith` array present a scalability issue if thousands of users are shared on one document?
   * **A:** Yes. Storing massive arrays inside a single MongoDB document can breach the 16MB document size limit and slow down queries operations. A better long-term architectural solution would be a separate relational Collection (e.g., `ArticlePermissions`) linking UserIDs to ArticleIDs.
