#!/usr/bin/env bash
# Packages the extension for the Chrome Web Store / Edge Add-ons: dist/ado-pr-comments-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
out="dist/ado-pr-comments-${version}.zip"
mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json src icons -x '*.DS_Store'
echo "Built $out"
unzip -l "$out"
