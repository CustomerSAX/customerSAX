#!/usr/bin/env bash
# ============================================================
# scripts/cloudbuild-update-urls.sh
# Step 4 of Cloud Build pipeline — ported from JourneyAX / Metafy AI.
#
# Collects all Cloud Run service URLs and injects them into:
#   (a) bff          — routes all external traffic (needs all URLs)
#   (b) ai-assist    — needs commerce service URL
#   (c) ticketing    — needs auth URL (for token validation)
#   (d) admin        — needs auth URL
# ============================================================
set -euo pipefail

source /workspace/build_config.sh

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
  "admin"
)

echo "🔍 Fetching all Cloud Run service URLs..."
declare -A URL_MAP
for SVC in "${ALL_SVCS[@]}"; do
  RUN_SVC_NAME="csa-dev-${SVC}"
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
ADMIN_URL=$(get_url "ADMIN_URL")

# ── (a) bff — inject all downstream service URLs ──────────────────────────────
# Use ^~^ prefix so gcloud uses ~ as delimiter (URLs contain commas/colons)
echo ""
echo "🚀 Updating csa-dev-bff with all downstream URLs..."

BFF_ENV="NODE_ENV=production~SERVICE_NAME=bff~ENVIRONMENT=${ENVIRONMENT}"

for VAR in "${!URL_MAP[@]}"; do
  [ "${VAR}" = "BFF_URL" ] && continue
  BFF_ENV="${BFF_ENV}~${VAR}=${URL_MAP[${VAR}]}"
done

gcloud run services update "csa-dev-bff" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="^~^${BFF_ENV}" 2>/dev/null || \
  echo "  ⚠️  csa-dev-bff not yet deployed – will get URLs on next deploy"

# ── (b) ai-assist — needs commerce URL for product/order lookups ─────────────
AI_ENV="NODE_ENV=production,SERVICE_NAME=ai-assist,ENVIRONMENT=${ENVIRONMENT}"
[ -n "${COMMERCE_CT_URL}" ] && AI_ENV="${AI_ENV},AI_COMMERCE_SERVICE_URL=${COMMERCE_CT_URL}"
[ -n "${AUTH_URL}" ]         && AI_ENV="${AI_ENV},AUTH_SERVICE_URL=${AUTH_URL}"

echo ""
echo "🔧 Updating csa-dev-ai-assist..."
gcloud run services update "csa-dev-ai-assist" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="${AI_ENV}" 2>/dev/null || \
  echo "  ⚠️  csa-dev-ai-assist not yet deployed – will get URLs on next deploy"

# ── (c) ticketing — needs auth URL for token validation ──────────────────────
TICKET_ENV="NODE_ENV=production,SERVICE_NAME=ticketing,ENVIRONMENT=${ENVIRONMENT}"
[ -n "${AUTH_URL}" ] && TICKET_ENV="${TICKET_ENV},AUTH_SERVICE_URL=${AUTH_URL}"

echo ""
echo "🔧 Updating csa-dev-ticketing..."
gcloud run services update "csa-dev-ticketing" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="${TICKET_ENV}" 2>/dev/null || \
  echo "  ⚠️  csa-dev-ticketing not yet deployed – will get URLs on next deploy"

# ── (d) admin — needs auth URL ───────────────────────────────────────────────
ADMIN_ENV="NODE_ENV=production,SERVICE_NAME=admin,ENVIRONMENT=${ENVIRONMENT}"
[ -n "${AUTH_URL}" ] && ADMIN_ENV="${ADMIN_ENV},AUTH_SERVICE_URL=${AUTH_URL}"

echo ""
echo "🔧 Updating csa-dev-admin..."
gcloud run services update "csa-dev-admin" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --update-env-vars="${ADMIN_ENV}" 2>/dev/null || \
  echo "  ⚠️  csa-dev-admin not yet deployed – will get URLs on next deploy"

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
echo "📋 Set these in Vercel (for webapp / marketing):"
[ -n "${BFF_URL}" ]  && echo "  NEXT_PUBLIC_BFF_URL=${BFF_URL}"
[ -n "${AUTH_URL}" ] && echo "  NEXT_PUBLIC_AUTH_URL=${AUTH_URL}"
