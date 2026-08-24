#!/usr/bin/env bash
# ============================================================
# scripts/cloudbuild-deploy.sh
# Step 3 of Cloud Build pipeline — ported from JourneyAX / Metafy AI.
#
# - Sources /workspace/build_config.sh from Step 1
# - Reads /workspace/services_to_deploy.txt from Step 1
# - Runs `gcloud run deploy` per service with per-service tuning
# - Leaves Cloud Run IAM/public access untouched; manage service access separately.
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
  RUN_SVC_NAME="${NAME_PREFIX}-${SVC}"

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
      SECRETS="AI_GATEWAY_API_KEY=${NAME_PREFIX}-ai-gateway-api-key:latest,MONGO_URI=${NAME_PREFIX}-ticketing-mongo-uri:latest" ;;
    commerce-commercetools)
      SECRETS="COMMERCETOOLS_CLIENT_ID=${NAME_PREFIX}-commercetools-client-id:latest,COMMERCETOOLS_CLIENT_SECRET=${NAME_PREFIX}-commercetools-client-secret:latest" ;;
    ticketing|auth|admin)
      SECRETS="MONGO_URI=${NAME_PREFIX}-ticketing-mongo-uri:latest" ;;
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
    bff)
      # Build FEDERATED_SERVICES JSON from live Cloud Run URLs.
      # Subgraphs are deployed before bff so their URLs already exist.
      get_url() {
        gcloud run services describe "${NAME_PREFIX}-$1" \
          --region="${REGION}" --project="${PROJECT_ID}" \
          --format='value(status.url)' 2>/dev/null || echo ""
      }
      CT_URL=$(get_url "commerce-commercetools")
      TICK_URL=$(get_url "ticketing")
      ADMIN_URL=$(get_url "admin")
      FED_SERVICES="{}"
      if [ -n "${CT_URL}" ]; then
        FED_SERVICES=$(echo "${FED_SERVICES}" | \
          python3 -c "import sys,json; d=json.load(sys.stdin); d['commerce-commercetools']='${CT_URL}/graphql'; print(json.dumps(d))")
      fi
      if [ -n "${TICK_URL}" ]; then
        FED_SERVICES=$(echo "${FED_SERVICES}" | \
          python3 -c "import sys,json; d=json.load(sys.stdin); d['ticketing']='${TICK_URL}/graphql'; print(json.dumps(d))")
      fi
      if [ -n "${ADMIN_URL}" ]; then
        FED_SERVICES=$(echo "${FED_SERVICES}" | \
          python3 -c "import sys,json; d=json.load(sys.stdin); d['admin']='${ADMIN_URL}/graphql'; print(json.dumps(d))")
      fi
      echo "🔗 FEDERATED_SERVICES: ${FED_SERVICES}"
      SVC_ENV="^|^NODE_ENV=production|SERVICE_NAME=${SVC}|ENVIRONMENT=${ENVIRONMENT}|FEDERATED_SERVICES=${FED_SERVICES}" ;;
  esac

  # ── Build gcloud run deploy command ───────────────────────────────────────
  # Authentication/IAM is managed outside this deploy step. Passing
  # --allow-unauthenticated, --no-allow-unauthenticated, or
  # --no-invoker-iam-check causes gcloud to call SetIamPolicy, which is blocked
  # for the Cloud Build deploy identity in this project.
  DEPLOY_CMD=(
    gcloud run deploy "${RUN_SVC_NAME}"
    --image="${IMAGE}:${COMMIT_SHA}"
    --region="${REGION}"
    --project="${PROJECT_ID}"
    --platform=managed
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
