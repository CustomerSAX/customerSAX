#!/usr/bin/env bash
# ============================================================
# scripts/cloudbuild-deploy.sh
# Step 3 of Cloud Build pipeline — ported from JourneyAX / Metafy AI.
#
# - Sources /workspace/build_config.sh from Step 1
# - Reads /workspace/services_to_deploy.txt from Step 1
# - Runs `gcloud run deploy` per service with per-service tuning
# - Grants BFF SA run.invoker on all private services (idempotent)
#
# CRITICAL: Uses --update-env-vars and --update-secrets (NEVER --set-*)
# ============================================================
set -euo pipefail

source /workspace/build_config.sh

if [ ! -s /workspace/services_to_deploy.txt ]; then
  echo "✅ No services to deploy — skipping."
  exit 0
fi

SERVICES=()
while IFS= read -r line; do
  [ -n "${line}" ] && SERVICES+=("${line}")
done < /workspace/services_to_deploy.txt

echo "============================================================"
echo "🚀 Deploy to Cloud Run — customerSAX"
echo "   Environment: ${ENVIRONMENT}"
echo "   Project    : ${PROJECT_ID}"
echo "   Commit     : ${COMMIT_SHA}"
echo "   Services   : ${#SERVICES[@]}"
echo "============================================================"

deploy_service() {
  local SVC="$1"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚀 Deploying: ${SVC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  IMAGE="${REGISTRY}/${PROJECT_ID}/${ARTIFACT_REPO}/${SVC}"

  # Cloud Run service name (matches Terraform resource names)
  RUN_SVC_NAME="csa-dev-${SVC}"

  # ── Per-service Cloud Run scaling / resources ──────────────────────────────
  CONC=80
  case "${SVC}" in
    bff)                     MIN=1; MAX=20; MEM=1Gi;   CPU=2; PORT=8080; RUN_TIMEOUT=300s ;;
    auth)                    MIN=1; MAX=10; MEM=512Mi; CPU=1; PORT=8080; RUN_TIMEOUT=300s ;;
    ai-assist)               MIN=0; MAX=10; MEM=1Gi;   CPU=2; PORT=8080; RUN_TIMEOUT=600s; CONC=40 ;;
    commerce-commercetools)  MIN=0; MAX=5;  MEM=512Mi; CPU=1; PORT=8080; RUN_TIMEOUT=300s ;;
    ticketing)               MIN=0; MAX=5;  MEM=512Mi; CPU=1; PORT=8080; RUN_TIMEOUT=300s ;;
    admin)                   MIN=0; MAX=5;  MEM=512Mi; CPU=1; PORT=8080; RUN_TIMEOUT=300s ;;
    *)                       MIN=0; MAX=5;  MEM=512Mi; CPU=1; PORT=8080; RUN_TIMEOUT=300s ;;
  esac

  # ── Per-service Secret Manager secrets ────────────────────────────────────
  # Secrets were created by Terraform; we bind them at deploy time.
  # Format: ENV_VAR_NAME=secret-name:version
  case "${SVC}" in
    ai-assist)
      SECRETS="AI_GATEWAY_API_KEY=csa-dev-ai-gateway-api-key:latest" ;;
    commerce-commercetools)
      SECRETS="COMMERCETOOLS_CLIENT_ID=csa-dev-commercetools-client-id:latest,COMMERCETOOLS_CLIENT_SECRET=csa-dev-commercetools-client-secret:latest" ;;
    *)
      SECRETS="" ;;
  esac

  # ── Per-service env vars ───────────────────────────────────────────────────
  SVC_ENV="NODE_ENV=production,SERVICE_NAME=${SVC},ENVIRONMENT=${ENVIRONMENT}"

  case "${SVC}" in
    ai-assist)
      SVC_ENV="${SVC_ENV},DEFAULT_LLM_PROVIDER=openai,AI_COMMERCE_PLATFORM=commercetools" ;;
    commerce-commercetools)
      SVC_ENV="${SVC_ENV},COMMERCETOOLS_AUTH_URL=https://auth.us-central1.gcp.commercetools.com"
      SVC_ENV="${SVC_ENV},COMMERCETOOLS_API_URL=https://api.us-central1.gcp.commercetools.com" ;;
  esac

  # ── Public vs private ─────────────────────────────────────────────────────
  # bff  = public (GraphQL gateway — external entry point)
  # auth = public (login/register endpoints need direct access)
  # all others = private (called by bff via Google ID token)
  if [ "${SVC}" = "bff" ] || [ "${SVC}" = "auth" ]; then
    AUTH_FLAG="--allow-unauthenticated"
  else
    AUTH_FLAG="--no-allow-unauthenticated"
  fi

  # ── Build gcloud run deploy command ───────────────────────────────────────
  DEPLOY_CMD=(
    gcloud run deploy "${RUN_SVC_NAME}"
    --image="${IMAGE}:${COMMIT_SHA}"
    --region="${REGION}"
    --project="${PROJECT_ID}"
    --platform=managed
    "${AUTH_FLAG}"
    --min-instances="${MIN}"
    --max-instances="${MAX}"
    --memory="${MEM}"
    --cpu="${CPU}"
    --timeout="${RUN_TIMEOUT}"
    --concurrency="${CONC}"
    --port="${PORT}"
    --update-env-vars="${SVC_ENV}"
    --update-labels="service=${SVC},environment=${ENVIRONMENT},managed-by=cloud-build,git-sha=${COMMIT_SHA}"
  )

  if [ -n "${SECRETS}" ]; then
    DEPLOY_CMD+=(--update-secrets="${SECRETS}")
  fi

  "${DEPLOY_CMD[@]}"

  # ── Grant BFF's service account run.invoker on all private services ────────
  # The BFF mints a Google ID token for each downstream private service.
  # Cloud Run validates that token — so the BFF SA needs invoker on each.
  # api: lookup the SA from the BFF's own config (idempotent, survives SA changes).
  if [ "${SVC}" != "bff" ] && [ "${SVC}" != "auth" ]; then
    BFF_SA=$(gcloud run services describe "csa-dev-bff" \
      --region="${REGION}" --project="${PROJECT_ID}" \
      --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null \
      || echo "")
    if [ -n "${BFF_SA}" ]; then
      echo "🔐 Granting roles/run.invoker on ${RUN_SVC_NAME} to BFF SA: ${BFF_SA}"
      gcloud run services add-iam-policy-binding "${RUN_SVC_NAME}" \
        --region="${REGION}" --project="${PROJECT_ID}" \
        --member="serviceAccount:${BFF_SA}" \
        --role="roles/run.invoker" 2>/dev/null \
        || echo "  ⚠️  IAM binding skipped (will retry on next deploy)"
    fi
  fi

  # ── Print URL ─────────────────────────────────────────────────────────────
  SVC_URL=$(gcloud run services describe "${RUN_SVC_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='value(status.url)' 2>/dev/null || echo "")
  [ -n "${SVC_URL}" ] && echo "✅ ${RUN_SVC_NAME} → ${SVC_URL}"
}

for SVC in "${SERVICES[@]}"; do
  deploy_service "${SVC}"
done

echo ""
echo "✅ All services deployed to Cloud Run!"
