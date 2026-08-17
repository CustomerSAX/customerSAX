#!/usr/bin/env bash
# ============================================================
# scripts/cloudbuild-build-push.sh
# Step 2 of Cloud Build pipeline — ported from JourneyAX / Metafy AI.
#
# - Sources /workspace/build_config.sh from Step 1
# - Reads /workspace/services_to_deploy.txt from Step 1
# - Builds Docker images IN PARALLEL (max 4 concurrent)
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
echo "🐳 Build & Push Docker Images (parallel, max 4 concurrent)"
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
    # Build context is the REPO ROOT (not the app dir): the Dockerfiles COPY
    # shared workspace packages (packages/*, configs/*) that only exist at the
    # monorepo root, so an app-dir context cannot see them. -f still selects the
    # per-service Dockerfile.

  docker push --all-tags "${IMAGE}" 2>&1 | sed "s/^/  [${SVC}] /"

  echo "✅ [DONE ] ${SVC} → ${IMAGE}:${COMMIT_SHA}"
}

export -f build_push_svc
export REGISTRY PROJECT_ID ARTIFACT_REPO COMMIT_SHA

MAX_PARALLEL=4
declare -a PIDS=()
declare -a FAILED_SVCS=()

wait_for_slot() {
  while [ "${#PIDS[@]}" -ge "${MAX_PARALLEL}" ]; do
    local new_pids=()
    for pid in "${PIDS[@]}"; do
      if kill -0 "${pid}" 2>/dev/null; then
        new_pids+=("${pid}")
      else
        if ! wait "${pid}"; then
          FAILED_SVCS+=("pid:${pid}")
        fi
      fi
    done
    PIDS=("${new_pids[@]+${new_pids[@]}}")
    [ "${#PIDS[@]}" -lt "${MAX_PARALLEL}" ] && break
    sleep 1
  done
}

echo ""
echo "▶ Launching builds (${#SERVICES[@]} services, ${MAX_PARALLEL} parallel)..."
echo ""

for SVC in "${SERVICES[@]}"; do
  wait_for_slot
  build_push_svc "${SVC}" &
  PIDS+=($!)
done

echo ""
echo "⏳ Waiting for all builds to complete..."
for pid in "${PIDS[@]}"; do
  wait "${pid}" || FAILED_SVCS+=("pid:${pid}")
done

echo ""
if [ "${#FAILED_SVCS[@]}" -gt 0 ]; then
  echo "❌ Some builds failed: ${FAILED_SVCS[*]}"
  exit 1
fi

echo "✅ All ${#SERVICES[@]} images built and pushed successfully!"
