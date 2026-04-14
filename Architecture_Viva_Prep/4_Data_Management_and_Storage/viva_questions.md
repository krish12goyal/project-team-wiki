# Viva / Interview Questions: Data Management Layer

## Basic Level
1. **Q:** Provide a brief overview of the Tri-Layer Storage Synchronization Architecture.
   * **A:** Data is split across three pillars: MongoDB (fast metadata, querying), the File System (flat `.md` text storage), and the Local Git Repository (temporal history tracking).
2. **Q:** Why use MongoDB if we are primarily saving flat markdown files?
   * **A:** Flat files cannot be queried efficiently. MongoDB holds relational arrays (`sharedWith`), timestamps, and full-text indexes (`$text`) to allow the homepage application to load lightning-fast without traversing/parsing thousands of files on the disk.

## Intermediate Level
3. **Q:** When you click "Save", in what exact order do the three storage mechanisms execute?
   * **A:** 1. MongoDB Database Write  ->  2. File System Disk Write  ->  3. Git Auto-commit.
4. **Q:** If the `.md` File System writing fails (maybe the disk is full), will MongoDB still have the data?
   * **A:** Yes, because MongoDB writes are orchestrated *first*. If database writing fails, the whole request dumps. If the disk fails, the database still successfully retains the raw data.
5. **Q:** Explain the system's "Fallback Mechanism" if a legacy article is missing content in MongoDB.
   * **A:** When reading, the system checks `article.content`. If it is empty or missing, it self-heals by asynchronously calling `fileService.readArticle()` to extract the content directly out of the flat filesystem.

## Advanced Level
6. **Q:** What is the purpose of `migrationService.js`?
   * **A:** In software pipelines, database schemas gracefully evolve. If we started by associating articles with a literal string "author", and then updated to use ObjectId references (`owner`), old documents break. Migrations iterate through legacy databases and inject the exact correct schema format so the app doesn't hit Null Reference crashes.
7. **Q:** Imagine we switch the execution order to write to Disk first, and then MongoDB. Why is this structurally dangerous?
   * **A:** If Disk writes safely, but MongoDB validation fails immediately after (e.g., missing a required owner ID), the API returns an HTTP Error 400. The user assumes their save failed completely, but the text file on the server has actually been permanently modified. This results in heavy desynchronization.
