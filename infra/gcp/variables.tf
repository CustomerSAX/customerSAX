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

variable "commerce_image" {
  description = "Container image for the Commerce Gateway Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "commerce_commercetools_image" {
  description = "Container image for the commercetools adapter Cloud Run service."
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
  description = "Commerce platform adapter to use, for example commercetools, shopify, bigcommerce, or sfcc."
  type        = string
  default     = "commercetools"
}

variable "ai_gateway_base_url" {
  description = "Optional custom Vercel AI Gateway base URL."
  type        = string
  default     = ""
}
