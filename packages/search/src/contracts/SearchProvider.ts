import type {
  OrganizationSearchConfig,
  SearchCapabilityState
} from './SearchCapability';

export interface ISearchProvider<TClient = unknown> {
  readonly id: string;
  readonly name: string;
  initialize(config: OrganizationSearchConfig): Promise<void> | void;
  getStatus(): SearchCapabilityState;
  getClient(): TClient | null;
  dispose?(): void;
}

export class SearchProviderRegistry {
  private static instance: SearchProviderRegistry;
  private providers = new Map<string, ISearchProvider>();

  public static getInstance(): SearchProviderRegistry {
    if (!SearchProviderRegistry.instance) {
      SearchProviderRegistry.instance = new SearchProviderRegistry();
    }
    return SearchProviderRegistry.instance;
  }

  public register(provider: ISearchProvider): void {
    this.providers.set(provider.id, provider);
  }

  public get(id: string): ISearchProvider | undefined {
    return this.providers.get(id);
  }

  public getAll(): ISearchProvider[] {
    return Array.from(this.providers.values());
  }
}
