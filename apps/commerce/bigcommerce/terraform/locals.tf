locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-commerce-bigcommerce"

  labels = {
    app         = "csa"
    component   = "commerce-bigcommerce"
    environment = var.environment
    managed_by  = "terraform"
  }
}
