#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f package.json ]]; then
  echo "error: expected Next.js project" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js not found. Install from https://nodejs.org" >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies…"
  npm install
fi

echo "Starting Aretay Admin at http://localhost:3001"
npm run dev -- -p 3001
