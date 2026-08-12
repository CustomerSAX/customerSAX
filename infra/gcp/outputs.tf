output "bff_url" {
  description = "GraphQL BFF Cloud Run URL."
  value       = google_cloud_run_v2_service.bff.uri
}

output "ai_assist_url" {
  description = "AI Assist Cloud Run URL."
  value       = google_cloud_run_v2_service.ai_assist.uri
}

output "commerce_commercetools_url" {
  description = "commercetools adapter Cloud Run URL."
  value       = google_cloud_run_v2_service.commerce_commercetools.uri
}

output "commerce_shopify_url" {
  description = "Shopify adapter Cloud Run URL."
  value       = google_cloud_run_v2_service.commerce_shopify.uri
}

output "commerce_bigcommerce_url" {
  description = "BigCommerce adapter Cloud Run URL."
  value       = google_cloud_run_v2_service.commerce_bigcommerce.uri
}

output "commerce_sfcc_url" {
  description = "Salesforce Commerce Cloud adapter Cloud Run URL."
  value       = google_cloud_run_v2_service.commerce_sfcc.uri
}

output "documents_bucket" {
  description = "Cloud Storage bucket for attachments and exports."
  value       = google_storage_bucket.documents.name
}

output "analytics_dataset" {
  description = "BigQuery dataset for analytics and reports."
  value       = google_bigquery_dataset.analytics.dataset_id
}
