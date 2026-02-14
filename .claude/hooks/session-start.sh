#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install dependencies
# --ignore-scripts: skip the "prepare" lifecycle script which runs docs/lint/build
# --legacy-peer-deps: resolve peer dependency conflicts between eslint v10 and plugins
npm install --ignore-scripts --legacy-peer-deps
