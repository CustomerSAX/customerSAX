import type { CommerceProvider } from "@csa/commerce-contract";
import { createRemoteCommerceProvider } from "./remote-provider.js";
import { sampleCommerceProvider } from "./sample/provider.js";

const providerUrls: Record<string, string | undefined> = {
  bigcommerce: process.env.COMMERCE_BIGCOMMERCE_URL,
  commercetools: process.env.COMMERCE_COMMERCETOOLS_URL,
  salesforce: process.env.COMMERCE_SFCC_URL,
  sfcc: process.env.COMMERCE_SFCC_URL,
  shopify: process.env.COMMERCE_SHOPIFY_URL
};

export function getCommerceProvider(platform?: string): CommerceProvider {
  const selectedPlatform = platform ?? process.env.COMMERCE_PROVIDER ?? "commercetools";
  const url = providerUrls[selectedPlatform];

  if (!url) {
    return sampleCommerceProvider;
  }

  return createRemoteCommerceProvider(selectedPlatform, url);
}

