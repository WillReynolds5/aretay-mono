#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/aretay-backend"

if [[ ! -d "${BACKEND_DIR}/supabase" ]]; then
  echo "error: expected Supabase project at aretay-backend/supabase" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "error: Supabase CLI not found. Install with: brew install supabase/tap/supabase" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: Docker is not running. Start Docker Desktop, then rerun this script." >&2
  exit 1
fi

echo "Starting local Supabase for Aretay..."
supabase start --workdir "${BACKEND_DIR}"

echo
echo "Local Supabase is up. Connection details:"
supabase status --workdir "${BACKEND_DIR}"

echo
echo "Point the iOS app at local Supabase in aretay-ios/Config/Secrets.xcconfig:"
echo "  SUPABASE_URL = http:/\$()/127.0.0.1:54321"
echo "  SUPABASE_ANON_KEY = <anon key from the status output above>"
