#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$ROOT/.env.local" ]]; then
  if [[ -f "$ROOT/../aretay-admin/.env.local" ]]; then
    grep '^OPENROUTER_API_KEY=' "$ROOT/../aretay-admin/.env.local" >"$ROOT/.env.local" || true
  fi
  if [[ ! -s "$ROOT/.env.local" ]]; then
    echo "Missing .env.local — copy OPENROUTER_API_KEY from aretay-admin/.env.local"
    echo "  cp .env.local.example .env.local"
    exit 1
  fi
fi

cd "$ROOT"
npm run dev
