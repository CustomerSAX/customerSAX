locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-crm"

  labels = {
    app         = "csa"
    component   = "crm"
    environment = var.environment
    managed_by  = "terraform"
  }
}
