---
description: How to synchronize with remote and push changes without non-fast-forward errors
---

To ensure a clean history and avoid "non-fast-forward" push rejections, follow these steps before every push.

// turbo
1. Synchronize with the remote repository:
   ```bash
   git pull --rebase origin main
   ```

2. If merge conflicts occur:
   * **Identify** conflicting files using `git status`.
   * **Resolve** conflicts intelligently (prefer latest logical changes, do not discard meaningful updates).
   * **Stage** resolved files: `git add <file-paths>`
   * **Continue** the rebase: `git rebase --continue`
   * (Repeat if more conflicts appear).

3. Once the rebase is successful, push your changes:
   // turbo
   ```bash
   git push origin main
   ```

**Rules:**
* NEVER force push unless explicitly instructed.
* Preserve all meaningful content from both local and remote.
* Ensure commit history remains clean (no unnecessary merge commits).
* Retry push only after a successful rebase.
