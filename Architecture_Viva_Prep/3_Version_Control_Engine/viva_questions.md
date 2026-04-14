# Viva / Interview Questions: Version Control Engine (Git Logic)

## Basic Level
1. **Q:** Our application uses Git on the backend. What is the fundamental reason we chose this over Operational Transformation (OT)?
   * **A:** Simplicity. OT and CRDTs require complex algorithms. Node.js executing native Git commands gives us out-of-the-box diffing, robust history, and rollback capabilities without reinventing wheel algorithms.
2. **Q:** Does Git track NoSQL database changes in our app?
   * **A:** No. Git is strictly tracking the flat `.md` files stored in the server's `articles/` file system directory.

## Intermediate Level
3. **Q:** If User A and User B save the exact same article at the exact same moment, whose content wins the immediate UI state?
   * **A:** The system uses Last-Write-Wins (LWW). Whoever's network request takes longer and finishes last over-writes the database, and is what becomes actively viewable on the site.
4. **Q:** How does Git mitigate the data loss from the Last-Write-Wins overwrite?
   * **A:** Every single save triggers an atomic `git commit`. The previous user's changes are instantly snapped and locked into the Git history array, allowing them to restore it later via the frontend `/history.html` UI.
5. **Q:** Explain the "Autosave Dilemma" with our Git implementation.
   * **A:** Because `editor.html` automatically autosaves every 10 seconds, leaving the browser open generates enormous quantities of Git commits server-side (commit spam) filling the git graph.

## Advanced Level
6. **Q:** Node.js is heavily asynchronous. What catastrophic error would happen if two users executed `git commit` simultaneously?
   * **A:** They would try to manipulate the `.git/index.lock` file concurrently. Git throws fatal lock errors, corrupting the index or entirely failing both transactions because Git operations on a single repository are not thread-safe.
7. **Q:** How did we solve the asynchronous Git Lock issue in Node.js?
   * **A:** By implementing a **Promise-based Mutex Queue**. The `gitMutex` class links incoming Git commands into a single `this.queue = this.queue.then(...)` promise chain. Even if events arrive at the same millisecond, they are forced into a strict, single-file sequential execution line.
