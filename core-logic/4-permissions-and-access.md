# Role-Based Access Control and Permissions

Permissions in the Team Wiki are calculated defensively on the backend and responsively on the frontend.

## Data Structure

Every article in the MongoDB collection has two critical fields for access control:
1. `owner`: A singular `ObjectId` mapping to the user who created it (or legacy author mapping via migration scripts).
2. `sharedWith`: An array of objects `[{ user: ObjectId, permission: 'viewer' | 'editor' }]`.

## The `checkPermission` Funnel

The core gatekeeper in the API logic is a single synchronous function inside `articleService.js` called `checkPermission(article, user, requiredRole)`. Every single protected route—fetching an article, updating, deleting, or viewing history—funnels through this exact function before returning a response.

### Execution Order:
1. **Unregistered Fail**: Rejects instantly if `req.user` is null or malformed (401 error).
2. **Owner Bypass**: Checks if the requesting `user.id` matches `article.owner`. If yes, it immediately returns `'owner'` (Highest echelon).
3. **Array Search**: Loops through the `article.sharedWith` array to find a `user.id` match. Rejects with 403 Forbidden if not found.
4. **Hierarchical Math Check**: Maps roles to integer values (`viewer: 1`, `editor: 2`, `owner: 3`). If the matched user's integer value is strictly less than the required role's integer value (e.g. attempting to update requires `2`, but user is `viewer (1)`), it rejects with 403 Forbidden.

## Client-Side Rendering Rules

Because the backend blocks illegal actions with HTTP 403, the frontend masks the UI elements gracefully based on the effective permission computed defensively by the backend route.

The backend sends down a custom property `currentPermission` in the API payload when calling `GET /api/articles/:id`.

**In `article.html` (The view logic):**
- If `myPerm === 'editor' || myPerm === 'owner'`: The standard `Edit` button is injected into the DOM header.
- If `myPerm === 'owner'`: The `Share` button and `Delete` button are dynamically appended to the header string.

If a hacker inspects the source code, un-hides a button, and forcefully posts to `/api/articles/:id`, the `checkPermission` funnel intercepts the payload, the backend rejects it with 403 (often causing the UI to show an error toast), and the database remains completely safe.
