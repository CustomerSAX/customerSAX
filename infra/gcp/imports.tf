# ============================================================
# imports.tf
# Terraform 1.5+ native import blocks for all resources that
# pre-exist in GCP (created by bootstrap-services job or
# previous partial Terraform applies).
# These run automatically as part of `terraform apply`.
# ============================================================

# ── Artifact Registry ──────────────────────────────────────
import {
  id = "projects/customerservice-505511/locations/us-central1/repositories/csa-dev-repo"
  to = google_artifact_registry_repository.repo
}

# ── BigQuery ───────────────────────────────────────────────
import {
  id = "projects/customerservice-505511/datasets/csa_dev_analytics"
  to = google_bigquery_dataset.analytics
}

# ── Secret Manager ─────────────────────────────────────────
import {
  id = "projects/customerservice-505511/secrets/csa-dev-ai-gateway-api-key"
  to = google_secret_manager_secret.llm["ai_gateway_api_key"]
}

import {
  id = "projects/customerservice-505511/secrets/csa-dev-commercetools-client-id"
  to = google_secret_manager_secret.commerce["commercetools_client_id"]
}

import {
  id = "projects/customerservice-505511/secrets/csa-dev-commercetools-client-secret"
  to = google_secret_manager_secret.commerce["commercetools_client_secret"]
}

# ── Cloud Run Services ─────────────────────────────────────
import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-bff"
  to = google_cloud_run_v2_service.bff
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-auth"
  to = google_cloud_run_v2_service.auth
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-ai-assist"
  to = google_cloud_run_v2_service.ai_assist
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-commerce-commercetools"
  to = google_cloud_run_v2_service.commerce_commercetools
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-commerce-shopify"
  to = google_cloud_run_v2_service.commerce_shopify
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-commerce-bigcommerce"
  to = google_cloud_run_v2_service.commerce_bigcommerce
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-commerce-sfcc"
  to = google_cloud_run_v2_service.commerce_sfcc
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-admin"
  to = google_cloud_run_v2_service.admin
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-ticketing"
  to = google_cloud_run_v2_service.ticketing
}
