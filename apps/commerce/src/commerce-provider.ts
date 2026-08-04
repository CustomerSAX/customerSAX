import { createBigCommerceProvider } from "./bigcommerce/provider.js";
import { createCommercetoolsProvider } from "./commercetools/provider.js";
import { sampleCommerceProvider } from "./sample/provider.js";
import { createSalesforceCommerceProvider } from "./sfcc/provider.js";
import { createShopifyProvider } from "./shopify/provider.js";

export function getCommerceProvider(platform?: string) {
  return createCommerceProvider(platform ?? process.env.COMMERCE_PROVIDER);
}

function createCommerceProvider(platform: string | undefined) {
  if (!platform) {
    return sampleCommerceProvider;
  }

  if (platform === "commercetools") {
    return hasCommercetoolsConfig() ? createCommercetoolsProvider() : sampleCommerceProvider;
  }

  if (platform === "shopify") {
    return createShopifyProvider();
  }

  if (platform === "bigcommerce") {
    return createBigCommerceProvider();
  }

  if (platform === "sfcc" || platform === "salesforce") {
    return createSalesforceCommerceProvider();
  }

  throw new Error(`Unsupported commerce provider: ${platform}`);
}

function hasCommercetoolsConfig() {
  return Boolean(
    process.env.COMMERCETOOLS_PROJECT_KEY &&
      process.env.COMMERCETOOLS_CLIENT_ID &&
      process.env.COMMERCETOOLS_CLIENT_SECRET
  );
}
