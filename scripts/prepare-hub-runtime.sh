#!/usr/bin/env bash
# Shared platform authentication; provider credentials remain exclusively in Hub.
set -euo pipefail
: "${PROJECT_ID:?}" "${REGION:?}" "${NAME_PREFIX:?}"
HUB_PLATFORM_SECRET="${NAME_PREFIX}-hub-platform-config"
HUB_ENABLED_VERSION=$(gcloud secrets versions list "${HUB_PLATFORM_SECRET}" --project="${PROJECT_ID}" --filter='state=ENABLED' --limit=1 --format='value(name)')
if [ -z "${HUB_ENABLED_VERSION}" ]; then
  HUB_BOOTSTRAP_DIR=$(mktemp -d)
  trap 'rm -rf "${HUB_BOOTSTRAP_DIR}"' EXIT
  gcloud run services describe "${NAME_PREFIX}-connection-hub" --project="${PROJECT_ID}" --region="${REGION}" --format=json > "${HUB_BOOTSTRAP_DIR}/service.json"
  gcloud secrets versions access latest --secret="${NAME_PREFIX}-connection-hub-api-key" --project="${PROJECT_ID}" --out-file="${HUB_BOOTSTRAP_DIR}/execution-key"
  python3 scripts/hub-platform-config.py "${HUB_BOOTSTRAP_DIR}/service.json" "${HUB_BOOTSTRAP_DIR}/execution-key" "${HUB_BOOTSTRAP_DIR}/platform.json"
  gcloud secrets versions add "${HUB_PLATFORM_SECRET}" --project="${PROJECT_ID}" --data-file="${HUB_BOOTSTRAP_DIR}/platform.json" >/dev/null
fi
echo "Shared Connection Hub runtime registration is available."
