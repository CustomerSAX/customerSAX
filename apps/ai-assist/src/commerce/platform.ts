export function getCommercePlatform() {
  return process.env.AI_COMMERCE_PLATFORM ?? "commercetools";
}

export function getCommerceServiceUrl() {
  return process.env.AI_COMMERCE_SERVICE_URL ?? "";
}
