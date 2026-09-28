import type { OrganizationSearchConfig } from '../../contracts/SearchCapability';

export interface AlgoliaProviderConfig {
  appId: string;
  searchApiKey: string;
  indexName: string;
}

export function getAlgoliaConfigFromEnv(): AlgoliaProviderConfig | null {
  const appId =
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ||
    process.env.ALGOLIA_APP_ID ||
    '';
  const searchApiKey =
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY ||
    process.env.ALGOLIA_SEARCH_API_KEY ||
    '';
  const indexName =
    process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ||
    process.env.ALGOLIA_INDEX_NAME ||
    '';

  if (!appId || !searchApiKey || !indexName) {
    return null;
  }

  return {
    appId: appId.trim(),
    searchApiKey: searchApiKey.trim(),
    indexName: indexName.trim()
  };
}

export function resolveAlgoliaConfig(
  orgConfig?: Partial<OrganizationSearchConfig> | null
): AlgoliaProviderConfig | null {
  // If organization-level configuration provides credentials, use them
  if (orgConfig?.appId && orgConfig?.searchApiKey && orgConfig?.indexName) {
    return {
      appId: orgConfig.appId.trim(),
      searchApiKey: orgConfig.searchApiKey.trim(),
      indexName: orgConfig.indexName.trim()
    };
  }

  // Fallback to environment variables
  return getAlgoliaConfigFromEnv();
}
