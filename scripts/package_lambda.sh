#!/usr/bin/env bash
# Build a deployment zip with handlers/ and booking/ at the zip root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/build"
ZIP="$OUT_DIR/booking-api.zip"

rm -rf "$OUT_DIR/lambda_pkg"
mkdir -p "$OUT_DIR/lambda_pkg"
cp -R "$ROOT/src/booking" "$OUT_DIR/lambda_pkg/booking"
cp -R "$ROOT/src/handlers" "$OUT_DIR/lambda_pkg/handlers"
# Ensure clean bytecode is not required; strip caches if any copied.
find "$OUT_DIR/lambda_pkg" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

rm -f "$ZIP"
(
  cd "$OUT_DIR/lambda_pkg"
  zip -qr "$ZIP" booking handlers
)
echo "$ZIP"
