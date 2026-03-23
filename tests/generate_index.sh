#!/bin/bash
# ============================================================
# generate_index.sh
# Parses Git history for articles and generates index.json
# Usage: bash generate_index.sh
# ============================================================

ARTICLES_DIR="./articles"
OUTPUT_FILE="$ARTICLES_DIR/index.json"

# Ensure articles directory exists
mkdir -p "$ARTICLES_DIR"

echo "Generating article index from Git history..."

# Start JSON array
echo "[" > "$OUTPUT_FILE"

FIRST=true

# Loop through all .md files in articles/
for file in "$ARTICLES_DIR"/*.md; do
  # Skip if no .md files found
  [ -e "$file" ] || continue

  FILENAME=$(basename "$file")
  SLUG="${FILENAME%.md}"

  # Get last commit info for this file
  LAST_COMMIT=$(git log -1 --pretty=format:'%H|||%ai|||%s|||%an' -- "$file" 2>/dev/null)

  if [ -n "$LAST_COMMIT" ]; then
    HASH=$(echo "$LAST_COMMIT" | cut -d'|||' -f1)
    DATE=$(echo "$LAST_COMMIT" | cut -d'|||' -f2)
    MESSAGE=$(echo "$LAST_COMMIT" | cut -d'|||' -f3)
    AUTHOR=$(echo "$LAST_COMMIT" | cut -d'|||' -f4)
  else
    HASH=""
    DATE=""
    MESSAGE=""
    AUTHOR=""
  fi

  # Get first line of file as title
  TITLE=$(head -n 1 "$file" | sed 's/^#\s*//')

  # Add comma separator between entries
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> "$OUTPUT_FILE"
  fi

  # Write JSON entry
  cat >> "$OUTPUT_FILE" <<EOF
  {
    "slug": "$SLUG",
    "title": "$TITLE",
    "lastCommit": "$HASH",
    "lastUpdated": "$DATE",
    "lastMessage": "$MESSAGE",
    "author": "$AUTHOR"
  }
EOF

done

# Close JSON array
echo "]" >> "$OUTPUT_FILE"

echo "Index generated: $OUTPUT_FILE"
echo "Total articles: $(grep -c '"slug"' "$OUTPUT_FILE")"
