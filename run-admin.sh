#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_DIR="${ROOT_DIR}/aretay-admin"

if [[ ! -f "${ADMIN_DIR}/package.json" ]]; then
  echo "error: expected Next.js project at aretay-admin/" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js not found. Install from https://nodejs.org" >&2
  exit 1
fi

if [[ ! -d "${ADMIN_DIR}/node_modules" ]]; then
  echo "Installing dependencies…"
  npm install --prefix "${ADMIN_DIR}"
fi

echo "Starting Aretay Admin at http://localhost:3001"
npm run dev --prefix "${ADMIN_DIR}" -- -p 3001
