#!/usr/bin/env bash
# submit-documents.sh — Submit missing documents for a funding request awaiting them.
#
# Usage: ./scripts/submit-documents.sh <id> [documents...] [BASE_URL]
#
# Arguments:
#   id           Request UUID
#   documents    One or more document codes: identity, income_proof, bank_statement
#                Defaults to all three if not specified
#   BASE_URL     Defaults to http://localhost:3000
#
# Examples:
#   ./scripts/submit-documents.sh abc-123
#   ./scripts/submit-documents.sh abc-123 identity income_proof bank_statement
#   ./scripts/submit-documents.sh abc-123 income_proof bank_statement
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

VALID_DOCS=("identity" "income_proof" "bank_statement")

# ── Dependency check ──────────────────────────────────────────────────────────
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Command '$cmd' not found. Please install it before running this script."
    exit 1
  fi
done

# ── Argument parsing ──────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  err "Usage: $0 <id> [documents...] [BASE_URL]"
  err "  Valid documents: identity, income_proof, bank_statement"
  err "  Example: $0 abc-123"
  err "  Example: $0 abc-123 identity income_proof bank_statement"
  exit 1
fi

REQUEST_ID="$1"
shift

# Separate document codes from optional BASE_URL
DOCS=()
BASE_URL="http://localhost:3000"

for arg in "$@"; do
  if [[ "$arg" == http* ]]; then
    BASE_URL="$arg"
  else
    DOCS+=("$arg")
  fi
done

# Default to all documents if none specified
if [[ ${#DOCS[@]} -eq 0 ]]; then
  DOCS=("identity" "income_proof" "bank_statement")
fi

# Validate document codes
for doc in "${DOCS[@]}"; do
  valid=false
  for v in "${VALID_DOCS[@]}"; do
    [[ "$doc" == "$v" ]] && valid=true && break
  done
  if [[ "$valid" == false ]]; then
    err "Unknown document code: '$doc'"
    err "Valid codes: ${VALID_DOCS[*]}"
    exit 1
  fi
done

API_URL="$BASE_URL/funding-requests/$REQUEST_ID/documents"

# ── Build JSON payload ────────────────────────────────────────────────────────
DOCS_JSON=$(printf '%s\n' "${DOCS[@]}" | jq -R . | jq -sc .)
PAYLOAD=$(jq -n --argjson documents "$DOCS_JSON" '{ documents: $documents }')

# ── Submit documents ──────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Submitting documents for funding request"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Request ID : $REQUEST_ID"
log "Documents  : ${DOCS[*]}"
log "Endpoint   : POST $API_URL"
echo ""

HTTP_CODE=$(curl -s -o /tmp/_docs_response.json -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

case "$HTTP_CODE" in
  200)
    WF_ID=$(jq -r '.workflowId' /tmp/_docs_response.json)
    ok "Documents submitted successfully. Processing resumed."
    log "workflowId: $WF_ID"
    ;;
  404)
    err "Request not found: $REQUEST_ID (HTTP 404)"
    jq -r '.error' /tmp/_docs_response.json 2>/dev/null || true
    exit 1
    ;;
  409)
    warn "Conflict (HTTP 409) — request is not in WAITING_DOCUMENTS state."
    jq -r '.error' /tmp/_docs_response.json 2>/dev/null || true
    exit 1
    ;;
  *)
    err "Unexpected response (HTTP $HTTP_CODE)"
    jq '.' /tmp/_docs_response.json 2>/dev/null || true
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
