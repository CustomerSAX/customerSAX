locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-webapp"

  labels = {
    app         = "csa"
    component   = "webapp"
    environment = var.environment
    managed_by  = "terraform"
  }
}
