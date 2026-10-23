#!/usr/bin/env bash
# Shared routing for services participating in ticket reviews. AI Assist must
# query the federated gateway, which owns both ticket and commerce operations.
ai_review_service_env() {
  local SERVICE="$1"
  local VALUE="NODE_ENV=production,SERVICE_NAME=${SERVICE},ENVIRONMENT=${ENVIRONMENT}"
  case "${SERVICE}" in
    ai-assist)
      if [ -z "${BFF_URL:-}" ]; then
        echo "BFF_URL is required for AI Assist ticket and commerce operations" >&2
        return 1
      fi
      VALUE="${VALUE},AI_COMMERCE_SERVICE_URL=${BFF_URL%/}/graphql"
      ;;
    ticketing)
      if [ -z "${AI_ASSIST_URL:-}" ]; then
        echo "AI_ASSIST_URL is required for ticket review statuses" >&2
        return 1
      fi
      VALUE="${VALUE},AI_ASSIST_URL=${AI_ASSIST_URL%/}"
      ;;
    *) return 1 ;;
  esac
  if [ -n "${AUTH_URL:-}" ]; then VALUE="${VALUE},AUTH_SERVICE_URL=${AUTH_URL%/}"; fi
  printf '%s\n' "${VALUE}"
}
