import type { LiteClient } from 'algoliasearch/lite';
import type {
  OrganizationSearchConfig,
  SearchCapabilityState
} from '../../contracts/SearchCapability';
import {
  ISearchProvider,
  SearchProviderRegistry
} from '../../contracts/SearchProvider';
import { resolveAlgoliaConfig } from './configuration';
import { getOrCreateAlgoliaClient, resetAlgoliaClientCache } from './algoliaClient';

export class AlgoliaSearchProvider implements ISearchProvider<LiteClient> {
  public readonly id = 'algolia';
  public readonly name = 'Algolia';

  private client: LiteClient | null = null;
  private currentConfig: OrganizationSearchConfig | null = null;
  private statusState: SearchCapabilityState = {
    enabled: false,
    providerId: 'algolia',
    providerName: 'Algolia',
    status: 'unavailable',
    searchMode: 'Instant Search',
    message: 'Algolia Search has not been initialized.'
  };

  public initialize(config: OrganizationSearchConfig): void {
    this.currentConfig = config;

    if (!config.enabled) {
      this.client = null;
      this.statusState = {
        enabled: false,
        providerId: this.id,
        providerName: this.name,
        status: 'disabled',
        indexName: config.indexName,
        searchMode: 'Instant Search',
        message: 'Search is currently unavailable for this organization.'
      };
      return;
    }

    const resolved = resolveAlgoliaConfig(config);
    if (!resolved) {
      this.client = null;
      this.statusState = {
        enabled: true,
        providerId: this.id,
        providerName: this.name,
        status: 'error',
        searchMode: 'Instant Search',
        message: 'Algolia search credentials or index name are missing.'
      };
      return;
    }

    try {
      this.client = getOrCreateAlgoliaClient(resolved);
      this.statusState = {
        enabled: true,
        providerId: this.id,
        providerName: this.name,
        status: 'connected',
        indexName: resolved.indexName,
        searchMode: 'Instant Search'
      };
    } catch {
      this.client = null;
      this.statusState = {
        enabled: true,
        providerId: this.id,
        providerName: this.name,
        status: 'error',
        indexName: resolved.indexName,
        searchMode: 'Instant Search',
        message: 'Failed to initialize Algolia search client.'
      };
    }
  }

  public getStatus(): SearchCapabilityState {
    return { ...this.statusState };
  }

  public getConfig(): OrganizationSearchConfig | null {
    return this.currentConfig;
  }

  public getClient(): LiteClient | null {
    return this.client;
  }

  public dispose(): void {
    this.client = null;
    this.currentConfig = null;
    resetAlgoliaClientCache();
    this.statusState = {
      enabled: false,
      providerId: this.id,
      providerName: this.name,
      status: 'disconnected',
      searchMode: 'Instant Search'
    };
  }
}

// Automatically register default provider instance
SearchProviderRegistry.getInstance().register(new AlgoliaSearchProvider());
