import { liteClient } from 'algoliasearch/lite';
import type { LiteClient } from 'algoliasearch/lite';
import type { AlgoliaProviderConfig } from './configuration';

let cachedClient: LiteClient | null = null;
let cachedKey = '';

export function getOrCreateAlgoliaClient(
  config: AlgoliaProviderConfig
): LiteClient {
  const key = `${config.appId}:${config.searchApiKey}`;
  if (cachedClient && cachedKey === key) {
    return cachedClient;
  }

  cachedClient = liteClient(config.appId, config.searchApiKey);
  cachedKey = key;
  return cachedClient;
}

export function resetAlgoliaClientCache(): void {
  cachedClient = null;
  cachedKey = '';
}
