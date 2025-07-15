#!/bin/bash
# GitHub Pages SPA support - copy index.html to 404.html
# This ensures that client-side routing works properly on GitHub Pages
cp dist/index.html dist/404.html
echo "✓ Created 404.html for GitHub Pages SPA routing" 