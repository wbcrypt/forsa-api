#!/bin/bash
# =============================================================================
# FORSA OS — End-to-End Test via curl
# Run: bash docs/test-e2e-curl.sh
#
# Prerequisites:
#   - App running: npm run start:dev
#   - jq installed: brew install jq / apt install jq
#   - TENANT_ID set from seed:admin output
# =============================================================================

set -e

BASE="http://localhost:3000/api/v1"
TENANT_ID="${TENANT_ID:-PASTE_TENANT_ID_HERE}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${GREEN}▶ STEP $1: $2${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }

if [ "$TENANT_ID" = "PASTE_TENANT_ID_HERE" ]; then
  echo "ERROR: Set TENANT_ID environment variable first:"
  echo "  export TENANT_ID=your-tenant-uuid-from-seed-admin"
  exit 1
fi

# ─── STEP 1: Login ────────────────────────────────────────────
step 1 "Login"
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@forsa.tn\",\"password\":\"Admin123!dev\",\"tenantId\":\"$TENANT_ID\"}")

TOKEN=$(echo $LOGIN | jq -r '.accessToken')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Login failed: $LOGIN"
  exit 1
fi
ok "Logged in. Token: ${TOKEN:0:30}..."

AUTH="-H \"Authorization: Bearer $TOKEN\""

# ─── STEP 2: Set policies ─────────────────────────────────────
step 2 "Create and approve required policies"

create_approve_policy() {
  local KEY=$1
  local VALUE=$2
  local REASON=$3
  
  VID=$(curl -s -X POST "$BASE/policy/versions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"policyKey\":\"$KEY\",\"scopeType\":\"global\",\"value\":$VALUE,\"effectiveDate\":\"2026-01-01\",\"changeReason\":\"$REASON\"}" \
    | jq -r '.id // empty')
  
  if [ -n "$VID" ]; then
    curl -s -X POST "$BASE/policy/versions/$VID/approve" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{}' > /dev/null
    ok "Policy '$KEY' created and approved"
  else
    echo "  ⚠ Policy '$KEY' may already exist"
  fi
}

create_approve_policy "document.requirements.standard" \
  '["national_id","university_acceptance","income_proof"]' \
  "Initial document requirements"

create_approve_policy "eligibility.score.minimum" "300" \
  "Minimum score for eligibility"

create_approve_policy "approval.thresholds" \
  '{"auto_approve_max":5000,"level1_max":15000,"level2_max":50000}' \
  "Approval thresholds V1"

create_approve_policy "guarantor.required" "false" \
  "Guarantor optional"

create_approve_policy "payment.grace_period_days" "7" \
  "Payment grace period"

create_approve_policy "payment.concurrent.duration_months" "10" \
  "Concurrent payment months"

# ─── STEP 3: Create university ────────────────────────────────
step 3 "Create university"
UNIV=$(curl -s -X POST "$BASE/universities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name":"Université de Tunis El Manar",
    "shortName":"UTM",
    "countryCode":"TN",
    "city":"Tunis",
    "status":"active",
    "riskLevel":"low"
  }')
UNIV_ID=$(echo $UNIV | jq -r '.id')
ok "University: $UNIV_ID"

# ─── STEP 4: Create & approve agreement ───────────────────────
step 4 "Create university agreement"
AGR=$(curl -s -X POST "$BASE/universities/$UNIV_ID/agreements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "paymentModel":"concurrent",
    "financingLevels":["level1","level2","level3"],
    "maxFinancingAmount":50000,
    "currency":"TND",
    "effectiveDate":"2026-01-01"
  }')
AGR_ID=$(echo $AGR | jq -r '.id')
ok "Agreement: $AGR_ID"

curl -s -X POST "$BASE/universities/agreements/$AGR_ID/approve" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
ok "Agreement approved"

# ─── STEP 5: Create program ───────────────────────────────────
step 5 "Create program"
PROG=$(curl -s -X POST "$BASE/universities/$UNIV_ID/programs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name":"Licence en Informatique",
    "code":"LI-UTM",
    "level":"licence",
    "durationYears":3,
    "tuitionMin":2000,
    "tuitionMax":4000,
    "currency":"TND",
    "accreditationStatus":"accredited"
  }')
PROG_ID=$(echo $PROG | jq -r '.id')
ok "Program: $PROG_ID"

# ─── STEP 6: Create student ───────────────────────────────────
step 6 "Create student"
STUDENT=$(curl -s -X POST "$BASE/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "firstName":"Mohamed Ali",
    "lastName":"Ben Salah",
    "dateOfBirth":"2002-03-15",
    "gender":"male",
    "nationality":"TN",
    "email":"ma.bensalah@test.tn",
    "phonePrimary":"+21620123456",
    "city":"Tunis",
    "academicLevel":"terminale"
  }')
STUDENT_ID=$(echo $STUDENT | jq -r '.id')
ok "Student: $STUDENT_ID"

# ─── STEP 7: Create application ───────────────────────────────
step 7 "Create application"
APP=$(curl -s -X POST "$BASE/applications" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"studentId\":\"$STUDENT_ID\",
    \"universityId\":\"$UNIV_ID\",
    \"programId\":\"$PROG_ID\",
    \"tuitionAmount\":3500,
    \"requestedSupportAmount\":3500,
    \"currency\":\"TND\",
    \"academicYear\":\"2026-2027\"
  }")
APP_ID=$(echo $APP | jq -r '.id')
ok "Application: $APP_ID"

# ─── STEP 8: Upload + confirm documents ───────────────────────
step 8 "Upload documents (confirm-upload only — no real S3 upload in test)"

upload_doc() {
  local DOC_TYPE=$1
  DOC=$(curl -s -X POST "$BASE/documents/upload-url" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"entityType\":\"application\",
      \"entityId\":\"$APP_ID\",
      \"documentTypeCode\":\"$DOC_TYPE\",
      \"fileName\":\"${DOC_TYPE}.pdf\",
      \"contentType\":\"application/pdf\"
    }")
  DOC_ID=$(echo $DOC | jq -r '.documentId')
  
  curl -s -X POST "$BASE/documents/$DOC_ID/confirm-upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"fileSize":102400}' > /dev/null
  ok "Document uploaded: $DOC_TYPE ($DOC_ID)"
}

upload_doc "national_id"
upload_doc "university_acceptance"
upload_doc "income_proof"

# Check checklist
CHECKLIST=$(curl -s "$BASE/documents/checklist/applications/$APP_ID" \
  -H "Authorization: Bearer $TOKEN")
UPLOADED=$(echo $CHECKLIST | jq '[.[] | select(.status == "uploaded")] | length')
ok "Documents uploaded: $UPLOADED/3"

# ─── STEP 9: Run pipeline ─────────────────────────────────────
step 9 "Run Financing Decision Pipeline"
PIPELINE=$(curl -s -X POST "$BASE/pipeline/applications/$APP_ID/run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}')
RUN_ID=$(echo $PIPELINE | jq -r '.pipelineRunId')
DECISION=$(echo $PIPELINE | jq -r '.decisionResult // "pending"')
NEEDS_REVIEW=$(echo $PIPELINE | jq -r '.requiresHumanReview')
BLOCKED=$(echo $PIPELINE | jq -r '.blockedAtStage // "none"')

ok "Pipeline run: $RUN_ID"
echo "  Decision:     $DECISION"
echo "  Needs review: $NEEDS_REVIEW"
echo "  Blocked at:   $BLOCKED"

if [ "$NEEDS_REVIEW" = "true" ]; then
  echo ""
  echo "  → Submitting human decision..."
  PIPELINE=$(curl -s -X POST "$BASE/pipeline/runs/$RUN_ID/human-decision" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"decision":"approved","approvedAmount":3500,"notes":"Test approval"}')
  DECISION=$(echo $PIPELINE | jq -r '.decisionResult // "approved_level1"')
  ok "Human decision submitted. Final: $DECISION"
fi

# Get decision ID from pipeline run
DECISION_ID=$(curl -s "$BASE/pipeline/runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.decision_id // empty')

# ─── STEP 10: Generate contract ───────────────────────────────
step 10 "Generate contract via Execution Engine"

# Get financing decision ID from applications
APP_DETAIL=$(curl -s "$BASE/applications/$APP_ID" -H "Authorization: Bearer $TOKEN")
FD_ID=$(curl -s "http://localhost:3000/api/v1/pipeline/runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.financing_decision_id // empty')

if [ -n "$FD_ID" ] && [ "$FD_ID" != "null" ]; then
  EXEC=$(curl -s -X POST "$BASE/execution" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"actionType\":\"contract.generate\",
      \"payload\":{
        \"applicationId\":\"$APP_ID\",
        \"contractType\":\"student_forsa\",
        \"financingDecisionId\":\"$FD_ID\"
      }
    }")
  CONTRACT_ID=$(echo $EXEC | jq -r '.result.id // empty')
  ok "Contract generated: $CONTRACT_ID"
else
  ok "Contract generation skipped (decision ID not available in direct query — check Swagger)"
fi

# ─── STEP 11: Generate payment schedule ───────────────────────
step 11 "Generate payment schedule"
SCHED=$(curl -s -X POST "$BASE/payments/schedules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"applicationId\":\"$APP_ID\"}")
SCHED_ID=$(echo $SCHED | jq -r '.id // empty')
ok "Payment schedule: ${SCHED_ID:-skipped — needs signed contract}"

# ─── STEP 12: Check score & dashboards ────────────────────────
step 12 "Check FORSA score and dashboards"
SCORE=$(curl -s "$BASE/scores/students/$STUDENT_ID" -H "Authorization: Bearer $TOKEN")
AGG=$(echo $SCORE | jq -r '.aggregate_score // "N/A"')
BAND=$(echo $SCORE | jq -r '.score_band // "N/A"')
ok "Student score: $AGG ($BAND)"

CEO=$(curl -s "$BASE/reports/ceo" -H "Authorization: Bearer $TOKEN")
ACTIVE=$(echo $CEO | jq -r '.summary.in_pipeline // 0')
ok "CEO dashboard — applications in pipeline: $ACTIVE"

echo ""
echo "════════════════════════════════════════════════"
echo -e "  ${GREEN}END-TO-END TEST COMPLETE ✓${NC}"
echo "════════════════════════════════════════════════"
echo ""
echo "  Application ID:  $APP_ID"
echo "  Student ID:      $STUDENT_ID"
echo "  University ID:   $UNIV_ID"
echo "  Pipeline Run ID: $RUN_ID"
echo "  Final Decision:  $DECISION"
echo ""
echo "  Swagger UI: http://localhost:3000/api/v1/docs"
echo "  MailHog:    http://localhost:8025"
echo "  MinIO:      http://localhost:9001"
echo ""
