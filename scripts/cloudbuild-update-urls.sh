#!/usr/bin/env bash
# ============================================================
# scripts/cloudbuild-update-urls.sh
# Step 4 of Cloud Build pipeline — ported from JourneyAX / Metafy AI.
#
# Collects all Cloud Run service URLs and injects them into:
#   (a) bff          — routes all external traffic (needs all URLs, incl. crm)
#   (b) ai-assist    — needs the federated BFF GraphQL URL
#   (c) ticketing    — needs AI Assist and auth URLs
#   (d) subscriptions — needs auth URL
#   (e) admin        — needs auth URL
# ============================================================
set -euo pipefail

source /workspace/build_config.sh
source "$(dirname "${BASH_SOURCE[0]}")/cloudbuild-service-env.sh"

echo ""
echo "============================================================"
echo "🔗 Injecting internal service URLs — customerSAX"
echo "   Environment : ${ENVIRONMENT}"
echo "   Project     : ${PROJECT_ID}"
echo "============================================================"

ALL_SVCS=(
  "bff"
  "auth"
  "ai-assist"
  "commerce-commercetools"
  "ticketing"
  "subscriptions"
  "admin"
  "crm"
)

echo "🔍 Fetching all Cloud Run service URLs..."
declare -A URL_MAP
for SVC in "${ALL_SVCS[@]}"; do
  RUN_SVC_NAME="${NAME_PREFIX}-${SVC}"
  URL=$(gcloud run services describe "${RUN_SVC_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='value(status.url)' 2>/dev/null || echo "")
  if [ -n "${URL}" ]; then
    VAR=$(echo "${SVC}" | tr '[:lower:]-' '[:upper:]_')_URL
    URL_MAP["${VAR}"]="${URL}"
    echo "  ✅ ${VAR} = ${URL}"
  else
    echo "  ⏭️  ${RUN_SVC_NAME} not deployed yet – skipping"
  fi
done

get_url() {
  local KEY="$1"
  echo "${URL_MAP[${KEY}]:-}"
}

BFF_URL=$(get_url "BFF_URL")
AUTH_URL=$(get_url "AUTH_URL")
AI_ASSIST_URL=$(get_url "AI_ASSIST_URL")
COMMERCE_CT_URL=$(get_url "COMMERCE_COMMERCETOOLS_URL")
TICKETING_URL=$(get_url "TICKETING_URL")
SUBSCRIPTIONS_URL=$(get_url "SUBSCRIPTIONS_URL")
ADMIN_URL=$(get_url "ADMIN_URL")
CRM_URL=$(get_url "CRM_URL")

# ── (a) bff — inject all downstream service URLs ──────────────────────────────
# Use ^~^ prefix so gcloud uses ~ as delimiter (URLs contain commas/colons)
echo ""
echo "🚀 Updating ${NAME_PREFIX}-bff with all downstream URLs..."

BFF_ENV="NODE_ENV=production~SERVICE_NAME=bff~ENVIRONMENT=${ENVIRONMENT}~MONGO_ADMIN_DB=csa-admin~MONGO_PROJECTS_COLLECTION=csa_projects"

if [ -n "${BFF_URL}" ]; then
  BFF_ENV="${BFF_ENV}~MC_TICKETS_AUDIENCE=${BFF_URL}~MC_REFUNDS_AUDIENCE=${BFF_URL}~MC_REPLACEMENTS_AUDIENCE=${BFF_URL}"
fi

# Build FEDERATED_SERVICES JSON in pure bash. The cloud-sdk builder image no
# longer ships python3 on PATH ("python3: command not found", exit 127).
# Cloud Run service URLs only contain URL-safe characters, so no JSON escaping
# is needed. Keys are added in a fixed order; empty URLs are skipped.
fed_add() {
  if [ -n "$2" ]; then
    FED_SERVICES="${FED_SERVICES:+${FED_SERVICES},}\"$1\":\"$2/graphql\""
  fi
}
FED_SERVICES=""
fed_add "commerce-commercetools" "${COMMERCE_CT_URL}"
fed_add "ticketing" "${TICKETING_URL}"
fed_add "subscriptions" "${SUBSCRIPTIONS_URL}"
fed_add "admin" "${ADMIN_URL}"
fed_add "crm" "${CRM_URL}"
FED_SERVICES="{${FED_SERVICES}}"

BFF_ENV="${BFF_ENV}~FEDERATED_SERVICES=${FED_SERVICES}"

for VAR in "${!URL_MAP[@]}"; do
  [ "${VAR}" = "BFF_URL" ] && continue
  BFF_ENV="${BFF_ENV}~${VAR}=${URL_MAP[${VAR}]}"
done

gcloud run services update "${NAME_PREFIX}-bff" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="^~^${BFF_ENV}" 2>/dev/null || \
  echo "  ⚠️  ${NAME_PREFIX}-bff not yet deployed – will get URLs on next deploy"

# ── (b) ai-assist — federated ticket, admin and commerce operations ──────────
AI_ENV=$(ai_review_service_env ai-assist)

echo ""
echo "🔧 Updating ${NAME_PREFIX}-ai-assist..."
gcloud run services update "${NAME_PREFIX}-ai-assist" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="${AI_ENV}"

# ── (c) ticketing — AI review statuses and auth token validation ─────────────
TICKET_ENV=$(ai_review_service_env ticketing)

echo ""
echo "🔧 Updating ${NAME_PREFIX}-ticketing..."
gcloud run services update "${NAME_PREFIX}-ticketing" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="${TICKET_ENV}"

# ── (d) subscriptions — needs auth URL ───────────────────────────────────────
SUBSCRIPTIONS_ENV="NODE_ENV=production,SERVICE_NAME=subscriptions,ENVIRONMENT=${ENVIRONMENT}"
[ -n "${AUTH_URL}" ] && SUBSCRIPTIONS_ENV="${SUBSCRIPTIONS_ENV},AUTH_SERVICE_URL=${AUTH_URL}"

echo ""
echo "🔧 Updating ${NAME_PREFIX}-subscriptions..."
gcloud run services update "${NAME_PREFIX}-subscriptions" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="${SUBSCRIPTIONS_ENV}" 2>/dev/null || \
  echo "  ⚠️  ${NAME_PREFIX}-subscriptions not yet deployed – will get URLs on next deploy"

# ── (e) admin — needs auth URL ───────────────────────────────────────────────
ADMIN_ENV="NODE_ENV=production,SERVICE_NAME=admin,ENVIRONMENT=${ENVIRONMENT}"
[ -n "${AUTH_URL}" ] && ADMIN_ENV="${ADMIN_ENV},AUTH_SERVICE_URL=${AUTH_URL}"

echo ""
echo "🔧 Updating ${NAME_PREFIX}-admin..."
gcloud run services update "${NAME_PREFIX}-admin" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="${ADMIN_ENV}" 2>/dev/null || \
  echo "  ⚠️  ${NAME_PREFIX}-admin not yet deployed – will get URLs on next deploy"

echo ""
echo "✅ All internal service URL injections complete!"
echo ""
echo "============================================================"
echo "🎉 Cloud Build deployment pipeline complete!"
echo "   Environment : ${ENVIRONMENT}"
echo "   Project     : ${PROJECT_ID}"
echo "   Commit SHA  : ${COMMIT_SHA}"
echo "============================================================"
echo ""
echo "📋 Set these in Vercel (for studio / marketing):"
[ -n "${BFF_URL}" ]  && echo "  NEXT_PUBLIC_BFF_URL=${BFF_URL}"
[ -n "${AUTH_URL}" ] && echo "  NEXT_PUBLIC_AUTH_URL=${AUTH_URL}"
