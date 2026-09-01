#!/usr/bin/env bash
# ============================================================
# scripts/cloudbuild-build-push.sh
# Step 2 of Cloud Build pipeline — ported from JourneyAX / Metafy AI.
#
# - Sources /workspace/build_config.sh from Step 1
# - Reads /workspace/services_to_deploy.txt from Step 1
# - Builds Docker images one service at a time
# - Pushes :latest and :<COMMIT_SHA> tags to Artifact Registry
# ============================================================
set -euo pipefail

export DOCKER_BUILDKIT=1

source /workspace/build_config.sh

if [ ! -s /workspace/services_to_deploy.txt ]; then
  echo "✅ No services to build — skipping."
  exit 0
fi

SERVICES=()
while IFS= read -r line; do
  [ -n "${line}" ] && SERVICES+=("${line}")
done < /workspace/services_to_deploy.txt

echo "============================================================"
echo "🐳 Build & Push Docker Images (sequential)"
echo "   Registry : ${REGISTRY}"
echo "   Project  : ${PROJECT_ID}"
echo "   Commit   : ${COMMIT_SHA}"
echo "   Services : ${#SERVICES[@]}"
echo "   BuildKit : enabled"
echo "============================================================"

build_push_svc() {
  local SVC="$1"
  local IMAGE="${REGISTRY}/${PROJECT_ID}/${ARTIFACT_REPO}/${SVC}"

  # Map service name → app folder path
  case "${SVC}" in
    commerce-commercetools)  CONTEXT="apps/commerce/commercetools" ;;
    *)                       CONTEXT="apps/${SVC}" ;;
  esac

  # Use per-service Dockerfile if present, else root-level one
  local DOCKERFILE="${CONTEXT}/Dockerfile"
  if [ ! -f "${DOCKERFILE}" ]; then
    echo "  [${SVC}] ❌ No Dockerfile found at ${DOCKERFILE} — skipping"
    return 1
  fi

  echo "🔨 [START] ${SVC} (context: repo root · dockerfile: ${DOCKERFILE})"

  # Warm layer cache from :latest (falls back gracefully on first build)
  docker pull "${IMAGE}:latest" 2>/dev/null \
    && echo "  [${SVC}] ✓ Cache warmed from :latest" \
    || echo "  [${SVC}] ℹ No cache available (first build)"

  DOCKER_BUILDKIT=1 docker build \
    --build-arg "SERVICE_NAME=${SVC}" \
    --build-arg "BUILDKIT_INLINE_CACHE=1" \
    --cache-from "${IMAGE}:latest" \
    -t "${IMAGE}:latest" \
    -t "${IMAGE}:${COMMIT_SHA}" \
    -f "${DOCKERFILE}" \
    . 2>&1 | sed "s/^/  [${SVC}] /"
  local build_status="${PIPESTATUS[0]}"
  if [ "${build_status}" -ne 0 ]; then
    echo "  [${SVC}] ❌ Docker build failed with exit code ${build_status}"
    return "${build_status}"
  fi
    # Build context is the REPO ROOT (not the app dir): the Dockerfiles COPY
    # shared workspace packages (packages/*, configs/*) that only exist at the
    # monorepo root, so an app-dir context cannot see them. -f still selects the
    # per-service Dockerfile.

  docker push --all-tags "${IMAGE}" 2>&1 | sed "s/^/  [${SVC}] /"
  local push_status="${PIPESTATUS[0]}"
  if [ "${push_status}" -ne 0 ]; then
    echo "  [${SVC}] ❌ Docker push failed with exit code ${push_status}"
    return "${push_status}"
  fi

  echo "✅ [DONE ] ${SVC} → ${IMAGE}:${COMMIT_SHA}"
}

export -f build_push_svc
export REGISTRY PROJECT_ID ARTIFACT_REPO COMMIT_SHA

declare -a FAILED_SVCS=()

echo ""
echo "▶ Building ${#SERVICES[@]} service(s)..."
echo ""

for SVC in "${SERVICES[@]}"; do
  if ! build_push_svc "${SVC}"; then
    FAILED_SVCS+=("${SVC}")
  fi
done

echo ""
if [ "${#FAILED_SVCS[@]}" -gt 0 ]; then
  echo "❌ Some builds failed: ${FAILED_SVCS[*]}"
  exit 1
fi

echo "✅ All ${#SERVICES[@]} images built and pushed successfully!"
