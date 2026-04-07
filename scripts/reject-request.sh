#!/usr/bin/env bash
# reject-request.sh — Reject a funding request awaiting human validation.
#
# Usage: ./scripts/reject-request.sh <id> <validatorId> [reason] [BASE_URL]
#
# Arguments:
#   id           Request UUID
#   validatorId  Identifier of the validator submitting the decision
#   reason       Optional rejection reason (quote if it contains spaces)
#   BASE_URL     Defaults to http://localhost:3000
#
# Examples:
#   ./scripts/reject-request.sh abc-123 validator-001
#   ./scripts/reject-request.sh abc-123 validator-001 "Insufficient expense justification"
#   ./scripts/reject-request.sh abc-123 validator-001 "" http://localhost:4000
#
# Requires: curl, jq

set -euo pipefail

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

# ── Argument parsing ──────────────────────────────────────────────────────────
if [[ $# -lt 2 ]]; then
  err "Usage: $0 <id> <validatorId> [reason] [BASE_URL]"
  err "  Example: $0 abc-123 validator-001"
  err "  Example: $0 abc-123 validator-001 \"Insufficient expense justification\""
  exit 1
fi

REQUEST_ID="$1"
VALIDATOR_ID="$2"
REASON="${3:-}"
BASE_URL="${4:-http://localhost:3000}"

# If the third argument looks like a URL, treat it as BASE_URL
if [[ "$REASON" == http* ]]; then
  BASE_URL="$REASON"
  REASON=""
fi

API_URL="$BASE_URL/funding-requests/$REQUEST_ID/validate"

# ── Build JSON payload ────────────────────────────────────────────────────────
if [[ -n "$REASON" ]]; then
  PAYLOAD=$(jq -n \
    --arg validatorId "$VALIDATOR_ID" \
    --arg reason "$REASON" \
    '{ approved: false, validatorId: $validatorId, reason: $reason }')
else
  PAYLOAD=$(jq -n \
    --arg validatorId "$VALIDATOR_ID" \
    '{ approved: false, validatorId: $validatorId }')
fi

# ── Submit decision ───────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Rejecting funding request"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Request ID  : $REQUEST_ID"
log "Validator   : $VALIDATOR_ID"
[[ -n "$REASON" ]] && log "Reason      : $REASON"
log "Endpoint    : POST $API_URL"
echo ""

HTTP_CODE=$(curl -s -o /tmp/_reject_response.json -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

case "$HTTP_CODE" in
  200)
    DECISION=$(jq -r '.decision' /tmp/_reject_response.json)
    WF_ID=$(jq -r '.workflowId' /tmp/_reject_response.json)
    ok "Decision submitted: $DECISION"
    log "workflowId: $WF_ID"
    ;;
  404)
    err "Request not found: $REQUEST_ID (HTTP 404)"
    jq -r '.error' /tmp/_reject_response.json 2>/dev/null || true
    exit 1
    ;;
  409)
    warn "Conflict (HTTP 409) — request is not in PENDING_VALIDATION state."
    jq -r '.error' /tmp/_reject_response.json 2>/dev/null || true
    exit 1
    ;;
  *)
    err "Unexpected response (HTTP $HTTP_CODE)"
    jq '.' /tmp/_reject_response.json 2>/dev/null || true
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
