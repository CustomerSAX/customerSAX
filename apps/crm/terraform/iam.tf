resource "google_service_account" "service" {
  account_id   = substr(replace(local.service_name, "-", ""), 0, 28)
  display_name = "${local.service_name} runtime"
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count    = var.allow_unauthenticated ? 1 : 0
  name     = google_cloud_run_v2_service.service.name
  location = google_cloud_run_v2_service.service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
