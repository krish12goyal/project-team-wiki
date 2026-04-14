# Viva / Interview Questions: System Reliability & Offline Tech

## Basic Level
1. **Q:** How does a user know if their network internet cuts out while editing?
   * **A:** The system hooks into an error boundary. If the API `fetch()` fails natively in JS, the UI visually trips an offline state, changing the save status to a red/orange "Saved offline".
2. **Q:** Where does the offline data get stored? IndexedDB, Server Cache, or LocalStorage?
   * **A:** It is dumped into a direct JSON stringified blob inside the browser's native `localStorage` under the specific key `wiki_drafts`.

## Intermediate Level
3. **Q:** What is a "Fire-and-Forget" mechanism, and how is it used during a Git commit?
   * **A:** The `safeAutoCommit()` function executes Git commands, but internally swallows and logs any errors. It purposefully does *not* throw exceptions back to the API route. This ensures that a Git failure doesn't crash the user's UX experience if the database write already succeeded.
4. **Q:** When the user connects back to Wi-Fi, how does the app know to try syncing again automatically?
   * **A:** The frontend has a listener attached to the global DOM Window object: `window.addEventListener('online', syncOfflineDrafts)`. When the OS fires this event, the app wakes up and automatically attempts to flush the `localStorage` drafts via API posts.

## Advanced Level
5. **Q:** If a user is offline, saves a draft, turns off their laptop, and completely closes the browser, what happens when they reopen the application 2 days later while online?
   * **A:** The `window.online` event listener won't fire because they established page load already online. However, `initEditor()` executes immediately on initialization, detects a stale offline draft waiting for that article ID in `localStorage`, and preemptively injects it into the DOM *before* the backend's original data can overlap and destroy it.
6. **Q:** Look at `server.js`. Why is registering the error middleware necessarily the *very last* `app.use()` function called in the entire codebase?
   * **A:** Express routes HTTP requests synchronously down the chain. If a route throws an exception (`next(err)`), the error falls downward. If the `errorHandler` was declared at the top, it would never be able catch the exceptions bleeding out of the controllers at the bottom.
