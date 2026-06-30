#!/usr/bin/env bash
#
# Aretay monorepo dev launcher — starts local Supabase + admin together.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.run.pids"

B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; D=$'\033[2m'; N=$'\033[0m'

usage() {
  cat <<EOF
${B}Aretay${N} — local dev launcher (backend + admin).

${B}Usage:${N}
  ./run.sh [command]

${B}Commands:${N}
  start              Boot Supabase, then start admin (default)
  stop               Stop admin + local Supabase stack
  keys               Print SUPABASE_URL + ANON_KEY for Secrets.xcconfig
  voice              Boot Supabase + serve Edge Functions (voice review loop)
  help               Show this message

${B}Services:${N}
  Supabase API       http://127.0.0.1:54321
  Supabase Studio    http://127.0.0.1:54323
  Admin console      http://localhost:3001

${D}iOS: open aretay-ios/Aretay.xcodeproj in Xcode and press ⌘R.
     Admin + local Supabase live under aretay-web/.${N}
EOF
}

save_pids() {
  : >"$PID_FILE"
  [[ -n "${ADMIN_PID:-}" ]] && echo "admin=$ADMIN_PID" >>"$PID_FILE"
  [[ -n "${FUNCTIONS_PID:-}" ]] && echo "functions=$FUNCTIONS_PID" >>"$PID_FILE"
}

clear_pids() {
  rm -f "$PID_FILE"
}

stop_saved_pids() {
  [[ -f "$PID_FILE" ]] || return 0
  local line key pid
  while IFS='=' read -r key pid; do
    [[ -n "$pid" ]] || continue
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      printf "${Y}→${N} Stopped %s (pid %s)\n" "$key" "$pid"
    fi
  done <"$PID_FILE"
  clear_pids
}

cleanup() {
  stop_saved_pids
}

cmd_start() {
  trap cleanup INT TERM EXIT

  printf "${B}→${N} Starting backend…\n"
  "$ROOT/aretay-web/run-backend.sh" start

  printf "\n${B}→${N} Starting admin…\n"
  "$ROOT/aretay-web/run-admin.sh" &
  ADMIN_PID=$!
  save_pids

  printf "\n${G}✔${N} Dev stack is up.\n\n"
  printf "  ${D}Supabase API${N}    http://127.0.0.1:54321\n"
  printf "  ${D}Supabase Studio${N} http://127.0.0.1:54323\n"
  printf "  ${D}Admin console${N}   http://localhost:3001\n\n"
  printf "${D}Press Ctrl+C to stop admin. Run ./run.sh stop to shut down Supabase too.${N}\n\n"

  wait "$ADMIN_PID"
}

cmd_stop() {
  stop_saved_pids
  printf "${B}→${N} Stopping backend…\n"
  "$ROOT/aretay-web/run-backend.sh" stop
  printf "${G}✔${N} All services stopped.\n"
}

cmd_keys() {
  "$ROOT/aretay-web/run-backend.sh" keys
}

cmd_voice() {
  trap cleanup INT TERM EXIT

  printf "${B}→${N} Starting voice review dev loop…\n"
  "$ROOT/aretay-web/run-backend.sh" start

  printf "\n${B}→${N} Serving Edge Functions…\n"
  "$ROOT/aretay-web/run-backend.sh" serve-functions &
  FUNCTIONS_PID=$!
  save_pids

  printf "\n${G}✔${N} Voice review backend is up.\n"
  printf "${D}Run ./run.sh start in another terminal for admin, then build iOS on a real device.${N}\n\n"

  wait "$FUNCTIONS_PID"
}

main() {
  local cmd="${1:-start}"
  shift || true
  case "$cmd" in
    start|"") cmd_start ;;
    stop)     cmd_stop ;;
    keys)     cmd_keys ;;
    voice)    cmd_voice ;;
    help|-h|--help) usage ;;
    *)
      printf "${R}unknown command:${N} %s\n\n" "$cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
