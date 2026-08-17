resource "google_secret_manager_secret_iam_member" "secret_access" {
  for_each = var.secret_env_vars

  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.service.email}"
}
