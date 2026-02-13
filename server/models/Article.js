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
    // Author username
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
  },
  {
    // Automatically manage createdAt and updatedAt
    timestamps: true,
  }
);

// Full-text search index on title and tags
articleSchema.index({ title: 'text', tags: 'text' });

module.exports = mongoose.model('Article', articleSchema);
