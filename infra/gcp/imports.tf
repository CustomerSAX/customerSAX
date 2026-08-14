# ============================================================
# imports.tf
# Terraform 1.5+ native import blocks for resources that were
# created by a previous partial apply but are not in state.
# These run automatically as part of `terraform apply`.
# ============================================================

import {
  id = "projects/customerservice-505511/locations/us-central1/repositories/csa-dev-repo"
  to = google_artifact_registry_repository.repo
}

import {
  id = "projects/customerservice-505511/datasets/csa_dev_analytics"
  to = google_bigquery_dataset.analytics
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
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-auth"
  to = google_cloud_run_v2_service.auth
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-admin"
  to = google_cloud_run_v2_service.admin
}

import {
  id = "projects/customerservice-505511/locations/us-central1/services/csa-dev-ticketing"
  to = google_cloud_run_v2_service.ticketing
}
