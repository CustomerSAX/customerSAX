locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-ticketing"

  labels = {
    app         = "csa"
    component   = "ticketing"
    environment = var.environment
    managed_by  = "terraform"
  }
}
