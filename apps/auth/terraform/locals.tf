locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-auth"

  labels = {
    app         = "csa"
    component   = "auth"
    environment = var.environment
    managed_by  = "terraform"
  }
}
