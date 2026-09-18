import { UIConfig, UILibrary, DEFAULT_UI_CONFIG } from './UIConfig';
import { UIRegistry } from './UIRegistry';

export interface ResolveUIConfigParams {
  customerId?: string;
  projectId?: string;
  user?: {
    id?: string;
    email?: string;
    activeProjectKey?: string;
    role?: string;
    [key: string]: any;
  } | null;
}

// Built-in customer / project to UI library mapping for demonstration & tenant provisioning
const TENANT_UI_MAP: Record<string, UILibrary> = {
  'customer-a': 'csa-custom',
  'tenant-custom': 'csa-custom',
  'customer-b': 'mantine',
  'tenant-mantine': 'mantine',
  'customer-c': 'mui',
  'tenant-mui': 'mui',
  'customer-d': 'zcm',
  'tenant-zcm': 'zcm',
};

export function resolveUIConfig(params?: ResolveUIConfigParams): UIConfig {
  // 1. Browser runtime override (query param or localStorage)
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlUi = urlParams.get('ui') as UILibrary;
      if (urlUi && UIRegistry.hasAdapter(urlUi)) {
        return { library: urlUi };
      }

      const storedUi = localStorage.getItem('csa_ui_library') as UILibrary;
      if (storedUi && UIRegistry.hasAdapter(storedUi)) {
        return { library: storedUi };
      }
    } catch {
      // Ignore browser storage read issues
    }
  }

  // 2. Project or customer-based resolution
  if (params) {
    const key = (params.projectId || params.customerId || params.user?.activeProjectKey || '').toLowerCase();

    if (TENANT_UI_MAP[key]) {
      return { library: TENANT_UI_MAP[key] };
    }

    if (key.includes('mantine')) return { library: 'mantine' };
    if (key.includes('mui')) return { library: 'mui' };
    if (key.includes('zcm')) return { library: 'zcm' };
    if (key.includes('custom') || key.includes('csa')) return { library: 'csa-custom' };
  }

  // 3. Environment variable configuration
  if (typeof process !== 'undefined' && process.env) {
    const envLibrary = process.env.NEXT_PUBLIC_CSA_UI_LIBRARY as UILibrary;
    if (envLibrary && UIRegistry.hasAdapter(envLibrary)) {
      return { library: envLibrary };
    }
  }

  // 4. Safe fallback
  return DEFAULT_UI_CONFIG;
}
