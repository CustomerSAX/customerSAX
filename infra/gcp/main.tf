locals {
  name_prefix = "csa-${var.environment}"

  llm_secrets = {
    ai_gateway_api_key = "AI_GATEWAY_API_KEY"
  }

  commerce_secrets = {
    commercetools_client_id     = "COMMERCETOOLS_CLIENT_ID"
    commercetools_client_secret = "COMMERCETOOLS_CLIENT_SECRET"
  }

  services = [
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "firestore.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com"
  ]

  commerce_federated_services = {
    "commerce-commercetools" = google_cloud_run_v2_service.commerce_commercetools.uri
    "commerce-shopify"       = google_cloud_run_v2_service.commerce_shopify.uri
    "commerce-bigcommerce"   = google_cloud_run_v2_service.commerce_bigcommerce.uri
    "commerce-sfcc"          = google_cloud_run_v2_service.commerce_sfcc.uri
  }

  selected_commerce_service_url = (
    var.ai_commerce_service_url != "" ? var.ai_commerce_service_url :
    var.commerce_platform == "shopify" ? google_cloud_run_v2_service.commerce_shopify.uri :
    var.commerce_platform == "bigcommerce" ? google_cloud_run_v2_service.commerce_bigcommerce.uri :
    contains(["salesforce", "sfcc"], var.commerce_platform) ? google_cloud_run_v2_service.commerce_sfcc.uri :
    google_cloud_run_v2_service.commerce_commercetools.uri
  )
}

# Derive the compute service account email statically to avoid
# chicken-and-egg: data.google_project requires cloudresourcemanager API
# which hasn't been enabled yet on first apply.
locals {
  compute_sa_email = "${var.project_number}-compute@developer.gserviceaccount.com"
}

resource "google_project_service" "required" {
  for_each = toset(local.services)

  service            = each.value
  disable_on_destroy = false
}

resource "random_id" "suffix" {
  byte_length = 3
}

resource "google_secret_manager_secret" "llm" {
  for_each = local.llm_secrets

  secret_id = "${local.name_prefix}-${replace(each.key, "_", "-")}"

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "ai_assist_llm_keys" {
  for_each = google_secret_manager_secret.llm

  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.compute_sa_email}"

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "commerce" {
  for_each = local.commerce_secrets

  secret_id = "${local.name_prefix}-${replace(each.key, "_", "-")}"

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "commerce_keys" {
  for_each = google_secret_manager_secret.commerce

  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.compute_sa_email}"

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "documents" {
  name                        = "${local.name_prefix}-documents-${random_id.suffix.hex}"
  location                    = var.region
  uniform_bucket_level_access = true

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "${local.name_prefix}-repo"
  description   = "Docker repository for CSA backend services"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id = replace("${local.name_prefix}_analytics", "-", "_")
  location   = "US"

  depends_on = [google_project_service.required]
}



resource "google_cloud_run_v2_service" "bff" {
  name     = "${local.name_prefix}-bff"
  location = var.region

  template {
    containers {
      image = var.bff_image

      env {
        name  = "BFF_PORT"
        value = "8080"
      }

      env {
        name  = "BFF_COMMERCE_PLATFORM"
        value = var.commerce_platform
      }

      env {
        name  = "FEDERATED_SERVICES"
        value = jsonencode(local.commerce_federated_services)
      }
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

# allUsers IAM binding removed — org policy (constraints/gcp.resourceLocations)
# blocks fully-public Cloud Run invocations. BFF is authenticated via the
# GitHub Actions service account at the API Gateway layer instead.

resource "google_cloud_run_v2_service" "commerce_commercetools" {
  name     = "${local.name_prefix}-commerce-commercetools"
  location = var.region

  template {
    containers {
      image = var.commerce_commercetools_image

      env {
        name  = "COMMERCETOOLS_PORT"
        value = "8080"
      }

      env {
        name  = "COMMERCETOOLS_AUTH_URL"
        value = var.commercetools_auth_url
      }

      env {
        name  = "COMMERCETOOLS_API_URL"
        value = var.commercetools_api_url
      }

      env {
        name  = "COMMERCETOOLS_PROJECT_KEY"
        value = var.commercetools_project_key
      }

      env {
        name  = "COMMERCETOOLS_SCOPE"
        value = var.commercetools_scope
      }

      # Secrets are injected by Cloud Build at deploy time via --update-secrets
      # (see scripts/cloudbuild-deploy.sh). Terraform only bootstraps the
      # placeholder service; secrets are bound after the first real build.
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "commerce_shopify" {
  name     = "${local.name_prefix}-commerce-shopify"
  location = var.region

  template {
    containers {
      image = var.commerce_shopify_image

      env {
        name  = "SHOPIFY_PORT"
        value = "8080"
      }
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "commerce_bigcommerce" {
  name     = "${local.name_prefix}-commerce-bigcommerce"
  location = var.region

  template {
    containers {
      image = var.commerce_bigcommerce_image

      env {
        name  = "BIGCOMMERCE_PORT"
        value = "8080"
      }
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "commerce_sfcc" {
  name     = "${local.name_prefix}-commerce-sfcc"
  location = var.region

  template {
    containers {
      image = var.commerce_sfcc_image

      env {
        name  = "SFCC_PORT"
        value = "8080"
      }
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "ai_assist" {
  name     = "${local.name_prefix}-ai-assist"
  location = var.region

  template {
    containers {
      image = var.ai_assist_image

      env {
        name  = "AI_ASSIST_PORT"
        value = "8080"
      }

      env {
        name  = "DEFAULT_LLM_PROVIDER"
        value = "openai"
      }

      env {
        name  = "AI_COMMERCE_PLATFORM"
        value = var.commerce_platform
      }

      env {
        name  = "AI_COMMERCE_SERVICE_URL"
        value = local.selected_commerce_service_url
      }

      env {
        name  = "AI_GATEWAY_BASE_URL"
        value = var.ai_gateway_base_url
      }

      # Secrets are injected by Cloud Build at deploy time via --update-secrets
      # (see scripts/cloudbuild-deploy.sh). Terraform only bootstraps the
      # placeholder service; secrets are bound after the first real build.
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "auth" {
  name     = "${local.name_prefix}-auth"
  location = var.region

  template {
    containers {
      image = var.auth_image

      env {
        name  = "AUTH_PORT"
        value = "8080"
      }
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

# allUsers IAM binding removed — org policy blocks public Cloud Run invocations.
# Auth service is accessed via authenticated service-to-service calls.

resource "google_cloud_run_v2_service" "admin" {
  name     = "${local.name_prefix}-admin"
  location = var.region

  template {
    containers {
      image = var.admin_image

      env {
        name  = "ADMIN_PORT"
        value = "8080"
      }
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "ticketing" {
  name     = "${local.name_prefix}-ticketing"
  location = var.region

  template {
    containers {
      image = var.ticketing_image

      env {
        name  = "TICKETING_PORT"
        value = "8080"
      }
    }
  }

  lifecycle {
    ignore_changes = [template]
  }

  depends_on = [google_project_service.required]
}
