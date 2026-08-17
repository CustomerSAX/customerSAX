#!/usr/bin/env bash
# ============================================================
# scripts/cloudbuild-detect.sh
# Step 1 of Cloud Build pipeline — ported from JourneyAX / Metafy AI.
#
# - Detects which customerSAX backend services changed via git diff
# - Writes /workspace/services_to_deploy.txt  (one service per line)
# - Writes /workspace/build_config.sh          (sourced by later steps)
# - Configures Docker credentials for Artifact Registry
#
# customerSAX backend Cloud Run services:
#   bff                     → csa-dev-bff            (public GraphQL gateway)
#   auth                    → csa-dev-auth            (public auth entry point)
#   ai-assist               → csa-dev-ai-assist       (private)
#   commerce-commercetools  → csa-dev-commerce-commercetools (private)
#   ticketing               → csa-dev-ticketing       (private)
#   admin                   → csa-dev-admin           (private)
#
# Frontend (Vercel — excluded from Cloud Build): studio, marketing, docs-site
# ============================================================
set -euo pipefail

REGION="us-central1"
REGISTRY="us-central1-docker.pkg.dev"

if [ "${BRANCH_NAME}" = "customerSAX-Prod" ]; then
  ENVIRONMENT="production"
elif [ "${BRANCH_NAME}" = "customerSAX-QA" ]; then
  ENVIRONMENT="qa"
else
  ENVIRONMENT="dev"
fi

ARTIFACT_REPO="csa-${ENVIRONMENT}-repo"

echo "============================================================"
echo "🔍 Detect Changes — customerSAX"
echo "   Branch : ${BRANCH_NAME}"
echo "   Env    : ${ENVIRONMENT}"
echo "   Project: ${PROJECT_ID}"
echo "   Commit : ${COMMIT_SHA}"
echo "============================================================"

# Write shared config for downstream steps to source
cat > /workspace/build_config.sh <<EOF
REGION="${REGION}"
REGISTRY="${REGISTRY}"
ARTIFACT_REPO="${ARTIFACT_REPO}"
ENVIRONMENT="${ENVIRONMENT}"
PROJECT_ID="${PROJECT_ID}"
COMMIT_SHA="${COMMIT_SHA}"
NAME_PREFIX="csa-${ENVIRONMENT}"
EOF

ALL_SVCS=(
  "bff"
  "auth"
  "ai-assist"
  "commerce-commercetools"
  "ticketing"
  "admin"
)

# ── Compute changed files ─────────────────────────────────────────────────────
# customerSAX-Prod receives merges from feature branches.
# Always deploy ALL services on Prod to guarantee the full stack is up-to-date.
# For feature branches, compare against Prod to detect per-service changes.
if [ "${BRANCH_NAME}" = "customerSAX-Prod" ]; then
  echo "⚠️  Production deployment — deploying ALL services"
  SERVICES_TO_DEPLOY=("${ALL_SVCS[@]}")
else
  BASE_BRANCH="customerSAX-Prod"

  MERGE_BASE=$(git merge-base HEAD "origin/${BASE_BRANCH}" 2>/dev/null || true)
  if [ -n "${MERGE_BASE}" ]; then
    CHANGED=$(git diff "${MERGE_BASE}" HEAD --name-only 2>/dev/null || echo "")
    echo "ℹ️  Using merge-base diff (base: ${BASE_BRANCH}, merge-base: ${MERGE_BASE:0:8})"
  else
    CHANGED=$(git diff HEAD^ HEAD --name-only 2>/dev/null \
      || git show --name-only --format="" HEAD 2>/dev/null \
      || echo "")
    echo "ℹ️  Using HEAD^ diff"
  fi

  echo ""
  echo "📂 Changed files (first 20):"
  echo "${CHANGED}" | grep -v '^$' | head -20 || true
  echo ""

  FILTERED=$(echo "${CHANGED}" | grep -vE \
    '(\.(md|txt|mdx)$|\.cursor/|\.gemini/|\.github/copilot|\.editorconfig|\.env\.example|README|CHANGELOG|docs/)' \
    || true)

  echo "📋 Build-relevant changed files:"
  echo "${FILTERED}" | grep -v '^$' | head -20 || true
  echo ""

  SERVICES_TO_DEPLOY=()

  if echo "${FILTERED}" | grep -qE "^(cloudbuild\.yaml|package\.json|pnpm-workspace\.yaml|turbo\.json)$"; then
    echo "⚠️  Core infra files changed → deploying ALL services"
    SERVICES_TO_DEPLOY=("${ALL_SVCS[@]}")
  elif echo "${FILTERED}" | grep -q "^scripts/"; then
    echo "⚠️  Build scripts changed → deploying ALL services"
    SERVICES_TO_DEPLOY=("${ALL_SVCS[@]}")
  elif echo "${FILTERED}" | grep -q "^\.github/workflows/"; then
    echo "⚠️  GitHub workflow changed → deploying ALL services"
    SERVICES_TO_DEPLOY=("${ALL_SVCS[@]}")
  elif echo "${FILTERED}" | grep -q "^packages/"; then
    echo "⚠️  Shared packages changed → deploying ALL services"
    SERVICES_TO_DEPLOY=("${ALL_SVCS[@]}")
  elif echo "${FILTERED}" | grep -q "^infra/"; then
    echo "⚠️  Infra changed → deploying ALL services"
    SERVICES_TO_DEPLOY=("${ALL_SVCS[@]}")
  else
    for SVC in "${ALL_SVCS[@]}"; do
      case "${SVC}" in
        commerce-commercetools)  APP_PATH="apps/commerce/commercetools" ;;
        *)                       APP_PATH="apps/${SVC}" ;;
      esac
      if echo "${FILTERED}" | grep -q "^${APP_PATH}/"; then
        SERVICES_TO_DEPLOY+=("${SVC}")
        echo "  → ${SVC} changed"
      fi
    done
  fi
fi

if [ ${#SERVICES_TO_DEPLOY[@]} -eq 0 ]; then
  echo "✅ No backend services changed — nothing to deploy."
  : > /workspace/services_to_deploy.txt
  exit 0
fi

printf '%s\n' "${SERVICES_TO_DEPLOY[@]}" > /workspace/services_to_deploy.txt

echo ""
echo "🔨 Services queued for deployment:"
cat /workspace/services_to_deploy.txt
echo ""

echo "🔐 Configuring Docker credentials for Artifact Registry..."
gcloud auth configure-docker "${REGISTRY}" --quiet
echo "✅ Docker credentials ready"
