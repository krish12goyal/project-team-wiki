/**
 * Article Model
 * Mongoose schema for wiki article metadata.
 * Content is stored as .md files; this schema tracks metadata for search and listing.
 */

const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    // Article title (required, indexed for text search)
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    // URL-safe slug derived from title (must be unique — maps to filename)
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Freeform tags for categorisation and filtering
    tags: {
      type: [String],
      default: [],
    },
    // Author username (Legacy - kept for git history/display)
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
    // Owner of the article (User ID)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: true, // TODO: Enable after migration
    },
    // List of users with shared access
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        permission: {
          type: String,
          enum: ['viewer', 'editor'],
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Primary content storage in MongoDB
    content: {
      type: String,
      default: '',
      trim: true
    },
  },
  {
    // Automatically manage createdAt and updatedAt
    timestamps: true,
  }
);

// Full-text search index on title and tags
articleSchema.index({ title: 'text', tags: 'text' });
// Index for permission checks
articleSchema.index({ 'sharedWith.user': 1 });
articleSchema.index({ owner: 1 });

module.exports = mongoose.model('Article', articleSchema);
