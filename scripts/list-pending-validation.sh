#!/usr/bin/env bash
# list-pending-validation.sh — List all funding requests awaiting human validation.
#
# Usage: ./scripts/list-pending-validation.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:3000
#
# Requires: curl, jq

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
API_URL="$BASE_URL/funding-requests/pending-validation"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()   { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
err()  { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

# ── Dependency check ──────────────────────────────────────────────────────────
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Command '$cmd' not found. Please install it before running this script."
    exit 1
  fi
done

# ── Fetch pending requests ────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Requests pending human validation — API: $BASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Calling GET $API_URL"

HTTP_CODE=$(curl -s -o /tmp/_pending_response.json -w "%{http_code}" "$API_URL")

if [[ "$HTTP_CODE" != "200" ]]; then
  err "API returned HTTP $HTTP_CODE"
  jq '.' /tmp/_pending_response.json 2>/dev/null || true
  exit 1
fi

COUNT=$(jq 'length' /tmp/_pending_response.json)

if [[ "$COUNT" -eq 0 ]]; then
  warn "No requests are currently pending validation."
  echo ""
  exit 0
fi

ok "$COUNT request(s) awaiting validation:"
echo ""

jq -c '.[]' /tmp/_pending_response.json | while IFS= read -r item; do
  echo -e "${GREEN}  ┌─ PENDING_VALIDATION ─────────────────────────────────────────┐${RESET}"
  echo "$item" | jq -r '
    "  │  id:          \(.id)",
    "  │  workflowId:  \(.workflowId)",
    "  │  userId:      \(.userId)",
    "  │  userEmail:   \(.userEmail)",
    "  │  amount:      €\(.amount)",
    "  │  purpose:     \(.purpose)",
    "  │  startTime:   \(.startTime)"
  '
  echo -e "${GREEN}  └─────────────────────────────────────────────────────────────┘${RESET}"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Done."
echo ""
