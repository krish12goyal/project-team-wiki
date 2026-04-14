# Offline Capabilities and Browser Storage

A critical part of the system's core logic is enabling continuous drafting even when a network disruption occurs. Because there is no client-side database like IndexedDB synced with TanStack Query (which was removed in the migration rollback), the application relies directly on raw `localStorage` mechanisms and browser events.

## The Auto-Save Error Boundary Trap

When a user edits an article, the Javascript in `editor.html` (or `create.html`) runs an auto-save interval every 10 seconds. 

### Online Path
If the network is up, `WikiAPI.updateArticle(id, data)` fulfills, the UI updates its status to "Saved" using a green dot indicator, and `clearOfflineDraft(id)` ensures no stale data clogs the system.

### Offline Path
If the network disconnects or the API request fails (e.g., throwing a `TypeError: Failed to fetch` or a generic error):
```javascript
catch (err) {
    saveOfflineDraft(articleId, data);
    updateStatus('Saved offline', 'offline');
}
```
The catch block gracefully catches the error and dumps the complete title, content, and tags into `localStorage` under the `wiki_drafts` JSON blob.

## The Re-Connection Hook

The application listens strictly for the browser's native `online` event fired by the DOM Window object.

```javascript
window.addEventListener('online', syncOfflineDrafts);
```

### The Synchronization Loop
When the Wi-Fi icon restores, `syncOfflineDrafts()` executes automatically in the background:
1. It parses `wiki_drafts` from `localStorage`.
2. It loops through all `[key, draft]` pairs asynchronously.
3. If the key is an ID, it calls `updateArticle`. If the key is `__new__` (an unsaved new creation), it calls `createArticle`.
4. Only upon HTTP success does it aggressively delete that specific draft from `localStorage`.
5. If the request fails *again* (perhaps the API is down even though the browser thinks it's online), no action is taken. The draft remains intact and awaits the next manual refresh or network bounce.

## Stale Draft Detection on Load
If a user closes the tab entirely while offline and opens it a week later, the connection hook doesn't help. Instead, the `initEditor()` function intercepts the load:

```javascript
const draft = getOfflineDraft(articleId);
if (draft) {
    titleInput.value = draft.title || '';
    contentInput.value = draft.content || '';
    tagsInput.value = (draft.tags || []).join(', ');
    showToast('Loaded from offline draft', 'info');
}
```
This forces the editor's DOM elements to populate from local storage *before* they populate from the backend response, preventing total data loss on tab closure.
