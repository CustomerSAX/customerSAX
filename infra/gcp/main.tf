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
}

data "google_project" "current" {}

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
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "ai_assist_llm_keys" {
  for_each = google_secret_manager_secret.llm

  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

resource "google_secret_manager_secret" "commerce" {
  for_each = local.commerce_secrets

  secret_id = "${local.name_prefix}-${replace(each.key, "_", "-")}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "commerce_keys" {
  for_each = google_secret_manager_secret.commerce

  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

resource "google_storage_bucket" "documents" {
  name                        = "${local.name_prefix}-documents-${random_id.suffix.hex}"
  location                    = var.region
  uniform_bucket_level_access = true

  depends_on = [google_project_service.required]
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id = replace("${local.name_prefix}_analytics", "-", "_")
  location   = "US"

  depends_on = [google_project_service.required]
}

resource "google_firestore_database" "realtime" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.required]
}

resource "google_sql_database_instance" "postgres" {
  name             = "${local.name_prefix}-postgres"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro"

    backup_configuration {
      enabled = true
    }
  }

  deletion_protection = true

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
        value = jsonencode({ "commerce-commercetools" = google_cloud_run_v2_service.commerce_commercetools.uri })
      }
    }
  }

  depends_on = [google_project_service.required]
}

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

      dynamic "env" {
        for_each = local.commerce_secrets

        content {
          name = env.value

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.commerce[env.key].secret_id
              version = "latest"
            }
          }
        }
      }
    }
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
        value = var.ai_commerce_service_url != "" ? var.ai_commerce_service_url : google_cloud_run_v2_service.commerce_commercetools.uri
      }

      env {
        name  = "AI_GATEWAY_BASE_URL"
        value = var.ai_gateway_base_url
      }

      dynamic "env" {
        for_each = local.llm_secrets

        content {
          name = env.value

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.llm[env.key].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required]
}
