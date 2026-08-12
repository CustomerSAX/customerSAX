locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-commerce-commercetools"

  labels = {
    app         = "csa"
    component   = "commerce-commercetools"
    environment = var.environment
    managed_by  = "terraform"
  }
}
