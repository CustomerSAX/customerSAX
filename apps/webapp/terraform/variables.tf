variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "dev"
}

variable "service_name" {
  description = "Optional Cloud Run service name override."
  type        = string
  default     = ""
}

variable "image" {
  description = "Container image for this component."
  type        = string
}

variable "port" {
  description = "Container port."
  type        = number
  default     = 8080
}

variable "env_vars" {
  description = "Plain environment variables for Cloud Run."
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Map of environment variable name to existing Secret Manager secret ID."
  type        = map(string)
  default     = {}
}

variable "allow_unauthenticated" {
  description = "Allow public unauthenticated invocations."
  type        = bool
  default     = true
}
