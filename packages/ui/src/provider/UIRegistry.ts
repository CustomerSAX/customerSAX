import { UIAdapter } from '../adapters/types';
import { csaCustomAdapter } from '../adapters/csa-custom';
import { mantineAdapter } from '../adapters/mantine';
import { muiAdapter } from '../adapters/mui';
import { zcmAdapter } from '../adapters/zcm';
import { UILibrary } from './UIConfig';

class UIRegistryClass {
  private adapters: Map<string, UIAdapter> = new Map();
  private fallbackLibrary: UILibrary = 'csa-custom';

  constructor() {
    this.registerAdapter(csaCustomAdapter);
    this.registerAdapter(mantineAdapter);
    this.registerAdapter(muiAdapter);
    this.registerAdapter(zcmAdapter);
  }

  public registerAdapter(adapter: UIAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(libraryId?: string): UIAdapter {
    if (libraryId && this.adapters.has(libraryId)) {
      return this.adapters.get(libraryId)!;
    }

    if (libraryId && libraryId !== this.fallbackLibrary && typeof window !== 'undefined') {
      console.warn(
        `[UIRegistry] Unknown UI library '${libraryId}'. Safely falling back to '${this.fallbackLibrary}'.`,
      );
    }

    return this.adapters.get(this.fallbackLibrary) || csaCustomAdapter;
  }

  public hasAdapter(libraryId: string): boolean {
    return this.adapters.has(libraryId);
  }

  public listAdapters(): UIAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const UIRegistry = new UIRegistryClass();
