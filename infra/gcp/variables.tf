variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "Primary GCP region."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name, for example dev, stage, or prod."
  type        = string
  default     = "dev"
}

variable "bff_image" {
  description = "Container image for the GraphQL BFF Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "ai_assist_image" {
  description = "Container image for the AI Assist Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "auth_image" {
  description = "Container image for the Auth Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "admin_image" {
  description = "Container image for the Admin Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "ticketing_image" {
  description = "Container image for the Ticketing Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "commerce_commercetools_image" {
  description = "Container image for the commercetools adapter Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "commerce_shopify_image" {
  description = "Container image for the Shopify adapter Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "commerce_bigcommerce_image" {
  description = "Container image for the BigCommerce adapter Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "commerce_sfcc_image" {
  description = "Container image for the Salesforce Commerce Cloud adapter Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "commercetools_project_key" {
  description = "commercetools project key used by the commerce connector."
  type        = string
  default     = ""
}

variable "commercetools_scope" {
  description = "OAuth scope for the commercetools API client."
  type        = string
  default     = ""
}

variable "commercetools_auth_url" {
  description = "commercetools OAuth base URL for the project region."
  type        = string
  default     = "https://auth.us-central1.gcp.commercetools.com"
}

variable "commercetools_api_url" {
  description = "commercetools API base URL for the project region."
  type        = string
  default     = "https://api.us-central1.gcp.commercetools.com"
}

variable "commerce_platform" {
  description = "Commerce platform adapter to use, for example commercetools, shopify, bigcommerce, salesforce, or sfcc."
  type        = string
  default     = "commercetools"

  validation {
    condition     = contains(["commercetools", "shopify", "bigcommerce", "salesforce", "sfcc"], var.commerce_platform)
    error_message = "commerce_platform must be one of: commercetools, shopify, bigcommerce, salesforce, sfcc."
  }
}

variable "ai_gateway_base_url" {
  description = "Optional custom Vercel AI Gateway base URL."
  type        = string
  default     = ""
}

variable "ai_commerce_service_url" {
  description = "Optional commerce GraphQL URL used by the AI Assist service. Defaults to the Cloud Run URL for commerce_platform."
  type        = string
  default     = ""
}
