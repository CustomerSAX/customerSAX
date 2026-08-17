locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-studio"

  labels = {
    app         = "csa"
    component   = "studio"
    environment = var.environment
    managed_by  = "terraform"
  }
}
