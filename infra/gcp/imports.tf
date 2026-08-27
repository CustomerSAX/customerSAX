# ============================================================
# imports.tf
# Terraform 1.5+ native import blocks for all resources that
# pre-exist in GCP (created by bootstrap-services job or
# previous partial Terraform applies).
# These run automatically as part of `terraform apply`.
# ============================================================

# ── Artifact Registry ──────────────────────────────────────
import {
  id = "projects/customerservice-505511/locations/us-central1/repositories/csa-${var.environment}-repo"
  to = google_artifact_registry_repository.repo
}

# ── BigQuery ───────────────────────────────────────────────
import {
  id = "projects/customerservice-505511/datasets/csa_${var.environment}_analytics"
  to = google_bigquery_dataset.analytics
}

# ── Secret Manager ─────────────────────────────────────────
import {
  id = "projects/customerservice-505511/secrets/csa-${var.environment}-ai-gateway-api-key"
  to = google_secret_manager_secret.llm["ai_gateway_api_key"]
}

import {
  id = "projects/customerservice-505511/secrets/csa-${var.environment}-commercetools-client-id"
  to = google_secret_manager_secret.commerce["commercetools_client_id"]
}

import {
  id = "projects/customerservice-505511/secrets/csa-${var.environment}-commercetools-client-secret"
  to = google_secret_manager_secret.commerce["commercetools_client_secret"]
}

import {
  id = "projects/customerservice-505511/secrets/csa-${var.environment}-ticketing-mongo-uri"
  to = google_secret_manager_secret.ticketing["ticketing_mongo_uri"]
}

# ── Cloud Run Services ─────────────────────────────────────
import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-bff"
  to = google_cloud_run_v2_service.bff
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-auth"
  to = google_cloud_run_v2_service.auth
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-ai-assist"
  to = google_cloud_run_v2_service.ai_assist
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-commerce-commercetools"
  to = google_cloud_run_v2_service.commerce_commercetools
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-commerce-shopify"
  to = google_cloud_run_v2_service.commerce_shopify
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-commerce-bigcommerce"
  to = google_cloud_run_v2_service.commerce_bigcommerce
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-commerce-sfcc"
  to = google_cloud_run_v2_service.commerce_sfcc
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-admin"
  to = google_cloud_run_v2_service.admin
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-${var.environment}-ticketing"
  to = google_cloud_run_v2_service.ticketing
}
