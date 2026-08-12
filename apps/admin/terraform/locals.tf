locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-admin"

  labels = {
    app         = "csa"
    component   = "admin"
    environment = var.environment
    managed_by  = "terraform"
  }
}
