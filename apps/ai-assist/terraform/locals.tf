locals {
  service_name = var.service_name != "" ? var.service_name : "csa-${var.environment}-ai-assist"

  labels = {
    app         = "csa"
    component   = "ai-assist"
    environment = var.environment
    managed_by  = "terraform"
  }
}
