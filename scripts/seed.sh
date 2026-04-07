#!/usr/bin/env bash
# seed.sh — Seeds test data by calling the funding requests API.
#
# Usage: ./scripts/seed.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:3000
#
# Requires: curl, jq

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
VALIDATE_URL="$BASE_URL/funding-requests"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()     { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()   { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
err()    { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

# ── Dependency check ──────────────────────────────────────────────────────────
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Command '$cmd' not found. Please install it before running this script."
    exit 1
  fi
done

# ── API availability check ────────────────────────────────────────────────────
log "Checking API availability: $BASE_URL"
if ! curl -sf "$BASE_URL/health" &>/dev/null && ! curl -sf "$VALIDATE_URL" &>/dev/null; then
  warn "API not responding at $BASE_URL. Make sure the server is running."
fi

# ── Helper: create a request and print the result ─────────────────────────────
create_request() {
  local label="$1"
  local payload="$2"

  log "Creating: $label"
  local response
  response=$(curl -sf -X POST "$VALIDATE_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1) || {
    err "Request failed for: $label"
    err "$response"
    return 1
  }

  local id workflowId status
  id=$(echo "$response" | jq -r '.id')
  workflowId=$(echo "$response" | jq -r '.workflowId')
  status=$(echo "$response" | jq -r '.status')
  ok "$label → id=$id | workflowId=$workflowId | status=$status"
  echo "$id"
}

# ── Seed data ─────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Seeding dataset — API: $BASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Auto-approved request (≤ €500, all documents provided)
ID_AUTO_APPROVED=$(create_request \
  "Auto-approval (€200, complete documents)" \
  '{
    "userId": "user-001",
    "userEmail": "alice@example.com",
    "amount": 200,
    "purpose": "Purchase of computer equipment",
    "documents": ["identity", "income_proof", "bank_statement"]
  }')

# 2. Request requiring human validation (> €500, all documents provided)
ID_PENDING=$(create_request \
  "Human validation required (€1500, complete documents)" \
  '{
    "userId": "user-002",
    "userEmail": "bob@example.com",
    "amount": 1500,
    "purpose": "Professional training",
    "documents": ["identity", "income_proof", "bank_statement"]
  }')

# 3. Request with missing documents (will enter WAITING_DOCUMENTS)
ID_MISSING_DOCS=$(create_request \
  "Missing documents (€300, identity only)" \
  '{
    "userId": "user-003",
    "userEmail": "carol@example.com",
    "amount": 300,
    "purpose": "Travel expenses",
    "documents": ["identity"]
  }')

# 4. Large request with no documents
ID_LARGE_MISSING=$(create_request \
  "Large request + no documents (€2000)" \
  '{
    "userId": "user-004",
    "userEmail": "david@example.com",
    "amount": 2000,
    "purpose": "Equipment investment",
    "documents": []
  }')

# 5. Request at the exact threshold (€500) — auto-approved
ID_THRESHOLD=$(create_request \
  "Exact threshold (€500, complete documents) — auto-approval" \
  '{
    "userId": "user-005",
    "userEmail": "eve@example.com",
    "amount": 500,
    "purpose": "Annual software subscription",
    "documents": ["identity", "income_proof", "bank_statement"]
  }')

# 6. Second request requiring human validation
ID_PENDING_2=$(create_request \
  "Second human validation (€750, complete documents)" \
  '{
    "userId": "user-006",
    "userEmail": "frank@example.com",
    "amount": 750,
    "purpose": "International conference",
    "documents": ["identity", "income_proof", "bank_statement"]
  }')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Waiting 3s for workflows to start..."
sleep 3

# ── Human validation for PENDING_VALIDATION requests ─────────────────────────
echo ""
log "Approving request pending validation: $ID_PENDING"
RESP=$(curl -sf -X POST "$VALIDATE_URL/$ID_PENDING/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "validatorId": "validator-001",
    "reason": "Complete file and justified amount"
  }' 2>&1) && ok "Request $ID_PENDING approved: $(echo "$RESP" | jq -r '.decision')" \
           || warn "Validation skipped for $ID_PENDING (may not be in PENDING_VALIDATION yet)"

echo ""
log "Rejecting second pending request: $ID_PENDING_2"
RESP=$(curl -sf -X POST "$VALIDATE_URL/$ID_PENDING_2/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": false,
    "validatorId": "validator-001",
    "reason": "Insufficient expense justification"
  }' 2>&1) && ok "Request $ID_PENDING_2 rejected: $(echo "$RESP" | jq -r '.decision')" \
           || warn "Validation skipped for $ID_PENDING_2 (may not be in PENDING_VALIDATION yet)"

# ── Submit missing documents for a waiting request ────────────────────────────
echo ""
log "Submitting missing documents for: $ID_MISSING_DOCS"
RESP=$(curl -sf -X POST "$VALIDATE_URL/$ID_MISSING_DOCS/documents" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": ["identity", "income_proof", "bank_statement"]
  }' 2>&1) && ok "Documents updated for $ID_MISSING_DOCS" \
           || warn "Update skipped for $ID_MISSING_DOCS (may not be in WAITING_DOCUMENTS yet)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Summary of created requests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for id in "$ID_AUTO_APPROVED" "$ID_PENDING" "$ID_MISSING_DOCS" "$ID_LARGE_MISSING" "$ID_THRESHOLD" "$ID_PENDING_2"; do
  STATE=$(curl -sf "$VALIDATE_URL/$id" 2>/dev/null | jq -r '"\(.status) | amount=\(.amount)€ | user=\(.userId)"' 2>/dev/null || echo "N/A")
  echo "  $id → $STATE"
done

echo ""
ok "Dataset seeded successfully."
echo ""
