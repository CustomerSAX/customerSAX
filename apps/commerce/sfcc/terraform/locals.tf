locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-commerce-sfcc"

  labels = {
    app         = "csa"
    component   = "commerce-sfcc"
    environment = var.environment
    managed_by  = "terraform"
  }
}
