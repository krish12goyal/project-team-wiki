# Concurrent Editing and State Management

Because the Team Wiki application lacks real-time WebSockets or advanced algorithms like Operational Transformation (OT) or CRDTs (Conflict-free Replicated Data Types), the system must handle concurrency via simpler mechanisms.

## Last-Write-Wins (LWW) Strategy

1. **The Scenario**: User A and User B open the same article in `/editor.html` at the exact same time. Both make different changes.
2. **The Mechanism**:
   - Neither the frontend nor the backend currently tracks an "ETag" or a "Document Version Number".
   - When User A clicks save, the backend overwrites the MongoDB record and the `.md` file with User A's content.
   - When User B clicks save 5 seconds later, the backend overwrites User A's changes with User B's content.
3. **Outcome**: The system uses a strict **Last-Write-Wins** policy. Whoever's network request reaches the server last dictates the final state of the database and filesystem.

## Mitigation: The Git Version history
While LWW causes immediate data overwriting, the application mitigates data loss via its **Git Service Integration**:
- Every save operation triggers an atomic `git commit`.
- Even though User B overwrote User A's content, User A's content is preserved exactly in the preceding Git commit.
- Users can go to the `/history.html` page and restore User A's commit. 

## The Git Mutex Queue (Thread Safety)
Node.js is asynchronous. If two users save at the exact same millisecond, spawning two parallel `git add` and `git commit` commands could corrupt the local Git repository's index.

To prevent this, `server/services/gitService.js` implements a strict **Promise-based Mutex Queue**:

```javascript
class Mutex {
    constructor() {
        this.queue = Promise.resolve();
    }

    lock(callback) {
        const next = this.queue.then(() => callback().catch(...));
        this.queue = next.catch(() => { });
        return next;
    }
}
const gitMutex = new Mutex();
```
When User A and User B save concurrently:
1. User A's MongoDB save finishes, and their Git transaction enters the Mutex.
2. User B's MongoDB save finishes, but their Git transaction is **queued behind** User A's transaction.
3. User A's commit completes safely.
4. User B's commit executes.

## Auto-Save Dilemmas
The editor runs an autosave every 10 seconds:
```javascript
autoSaveTimer = setInterval(autoSave, 10000);
```
In a multi-editor environment, this means the Last-Write-Wins overwrite happens automatically every 10 seconds. This results in heavy Git commit spam and aggressive overwrites if two people sit on the editor page simultaneously. 
