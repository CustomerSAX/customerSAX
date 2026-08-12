locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-commerce-shopify"

  labels = {
    app         = "csa"
    component   = "commerce-shopify"
    environment = var.environment
    managed_by  = "terraform"
  }
}
