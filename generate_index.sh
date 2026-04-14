#!/bin/bash
# generate_index.sh
# Parses git log for each .md file in articles/ and writes articles/index.json

# Navigate to the project root
cd "$(dirname "$0")"

INDEX="articles/index.json"
echo "[" > "$INDEX"
FIRST=1

# Find all markdown files in the articles directory
for file in articles/*.md; do
    # Verify file exists to gracefully handle empty directories
    [ -e "$file" ] || continue
    
    # Extract Git metadata (Hash, ISO Date, Author Name)
    LOG=$(git log -1 --format="%H|%cI|%an" -- "$file")
    HASH="$(echo "$LOG" | cut -d'|' -f1)"
    DATE="$(echo "$LOG" | cut -d'|' -f2)"
    AUTHOR="$(echo "$LOG" | cut -d'|' -f3)"

    SLUG=$(basename "$file" .md)

    if [ $FIRST -eq 0 ]; then echo "," >> "$INDEX"; fi
    
    # Append structured JSON block
    echo "  {" >> "$INDEX"
    echo "    \"slug\": \"$SLUG\"," >> "$INDEX"
    echo "    \"hash\": \"$HASH\"," >> "$INDEX"
    echo "    \"date\": \"$DATE\"," >> "$INDEX"
    echo "    \"author\": \"$AUTHOR\"" >> "$INDEX"
    echo -n "  }" >> "$INDEX"
    FIRST=0
done

echo "" >> "$INDEX"
echo "]" >> "$INDEX"

echo "Success: articles/index.json has been rebuilt!"
