#!/bin/bash
# Run this in your terminal to initialize git and push to GitHub
# Usage: cd /Users/ati/BedsideBlink && bash setup-github.sh

set -e
cd "$(dirname "$0")"

echo "=== Setting up Git ==="
rm -rf .git 2>/dev/null || true
git init
git add -A
git status

echo ""
echo "=== Creating initial commit ==="
git commit -m "Initial commit: BedsideBlink with customizable tiles and Supabase

Features:
- Face detection + long-blink selection
- Customizable tiles (main categories, sub-categories, items, sub-options)
- Hierarchical drill-down with breadcrumb navigation
- Drag-and-drop reordering
- Supabase persistence
- 4×2 grid layout, 6 items max per level
- Soothing voice options"

echo ""
if command -v gh &>/dev/null; then
  echo "=== GitHub CLI found. Creating repo and pushing ==="
  gh auth status || { echo "Run: gh auth login"; exit 1; }
  gh repo create BedsideBlink --public --source=. --remote=origin --push
  echo ""
  echo "Done! Repo: $(gh repo view --json url -q .url)"
else
  echo "=== GitHub CLI not installed ==="
  echo "1. Create a new repo at https://github.com/new named 'BedsideBlink'"
  echo "2. Then run:"
  echo "   git remote add origin https://github.com/YOUR_USERNAME/BedsideBlink.git"
  echo "   git branch -M main"
  echo "   git push -u origin main"
fi
