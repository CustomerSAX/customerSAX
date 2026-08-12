locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-bff"

  labels = {
    app         = "csa"
    component   = "bff"
    environment = var.environment
    managed_by  = "terraform"
  }
}
