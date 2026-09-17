#!/usr/bin/env bash
# Build the web frontend and package it for upload to shared hosting.
#
#   ./deploy-web.sh                 # uses the production API on Render
#   API_URL=https://... ./deploy-web.sh
#
# Produces myitineri-web.zip - upload it via cPanel File Manager and Extract.
set -euo pipefail

API_URL="${API_URL:-https://itinera-backend-ds3v.onrender.com/api}"

echo "Building against $API_URL"
rm -rf dist myitineri-web.zip

EXPO_PUBLIC_API_URL="$API_URL" npx expo export --platform web --output-dir dist

# .htaccess is what makes the 45 client-side routes work on Apache; without it
# only the homepage loads and every deep link 404s.
cp public_htaccess_for_bluehost.txt dist/.htaccess

( cd dist && zip -qr ../myitineri-web.zip . -x '.DS_Store' )

# Fail loudly rather than shipping a bundle pointed at localhost.
if ! grep -q "$(echo "$API_URL" | sed 's|https\?://||; s|/api$||')" dist/_expo/static/js/web/*.js; then
  echo "WARNING: API URL not found in the bundle - check EXPO_PUBLIC_API_URL" >&2
fi

echo
echo "Built: myitineri-web.zip ($(du -h myitineri-web.zip | cut -f1))"
echo "Upload to the domain's folder in cPanel, then right-click > Extract."
