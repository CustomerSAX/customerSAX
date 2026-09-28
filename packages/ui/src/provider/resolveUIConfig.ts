import { UIConfig, UILibrary, DEFAULT_UI_CONFIG } from './UIConfig';
import { UIRegistry } from './UIRegistry';

export interface ResolveUIConfigParams {
  customerId?: string;
  projectId?: string;
  organizationId?: string;
  organizationName?: string;
  user?: {
    id?: string;
    email?: string;
    activeClientId?: string;
    activeProjectKey?: string;
    tenantId?: string;
    role?: string;
    uiTheme?: string;
    organization?: {
      id?: string;
      name?: string;
      slug?: string;
      uiTheme?: string;
    };
    [key: string]: any;
  } | null;
}

// Built-in customer / project / organization to UI library mapping for demonstration & tenant provisioning
const TENANT_UI_MAP: Record<string, UILibrary> = {
  // Required examples
  'royal-cyber': 'mantine',
  'royal cyber': 'mantine',
  'direct-wines': 'mui',
  'direct wines': 'mui',
  // Default and built-in fixtures
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
  // 1. Developer runtime testing override (explicit dev override or URL parameter)
  if (typeof window !== 'undefined') {
    try {
      // 1a. URL parameter for testing/preview: ?ui=mantine
      const urlParams = new URLSearchParams(window.location.search);
      const urlUi = urlParams.get('ui') as UILibrary;
      if (urlUi && UIRegistry.hasAdapter(urlUi)) {
        return { library: urlUi };
      }

      // 1b. Explicit developer override (only if set by DevUISwitcher)
      const devOverride = localStorage.getItem('csa_dev_ui_override') as UILibrary;
      if (devOverride && UIRegistry.hasAdapter(devOverride)) {
        return { library: devOverride };
      }
    } catch {
      // Ignore browser storage read issues
    }
  }

  // 2. Organization-level UI Theme (The Source of Truth)
  if (params) {
    // 2a. Direct uiTheme on user or user.organization
    const explicitTheme = (
      params.user?.uiTheme ||
      params.user?.organization?.uiTheme
    ) as UILibrary | undefined;

    if (explicitTheme && UIRegistry.hasAdapter(explicitTheme)) {
      return { library: explicitTheme };
    }

    // 2b. Check cached organization theme from browser storage (saved by Super Admin)
    if (typeof window !== 'undefined') {
      try {
        const orgThemesRaw = localStorage.getItem('csa_org_themes');
        if (orgThemesRaw) {
          const orgThemes = JSON.parse(orgThemesRaw) as Record<string, string>;
          const userProjectClientIds = (params.user?.projects || [])
            .map((p: any) => p.clientId)
            .filter(Boolean) as string[];
          const emailDomainSlug = params.user?.email
            ? params.user.email.split('@')[1]?.split('.')[0]?.toLowerCase()
            : undefined;

          const candidates = [
            params.organizationId,
            params.organizationName,
            params.customerId,
            params.user?.activeClientId,
            ...userProjectClientIds,
            params.user?.organization?.id,
            params.user?.organization?.slug,
            params.user?.organization?.name,
            emailDomainSlug,
            params.user?.tenantId !== 'csa' ? params.user?.tenantId : undefined,
          ].filter(Boolean) as string[];

          for (const cand of candidates) {
            const hit = orgThemes[cand] || orgThemes[cand.toLowerCase()];
            if (hit && UIRegistry.hasAdapter(hit as UILibrary)) {
              return { library: hit as UILibrary };
            }
          }
        }
      } catch {
        // Ignore JSON or storage errors
      }
    }

    // 2c. Check built-in tenant/organization mapping
    const userProjectClientIds = (params.user?.projects || [])
      .map((p: any) => p.clientId)
      .filter(Boolean) as string[];
    const emailDomainSlug = params.user?.email
      ? params.user.email.split('@')[1]?.split('.')[0]?.toLowerCase()
      : undefined;

    const orgKeys = [
      params.organizationId,
      params.organizationName,
      params.customerId,
      params.projectId,
      params.user?.activeClientId,
      ...userProjectClientIds,
      params.user?.organization?.id,
      params.user?.organization?.slug,
      params.user?.organization?.name,
      emailDomainSlug,
      params.user?.tenantId !== 'csa' ? params.user?.tenantId : undefined,
    ].filter(Boolean) as string[];

    for (const key of orgKeys) {
      const lower = key.trim().toLowerCase();
      if (TENANT_UI_MAP[lower]) {
        return { library: TENANT_UI_MAP[lower] };
      }
      if (lower.includes('mantine')) {
        return { library: 'mantine' };
      }
      if (lower.includes('mui')) {
        return { library: 'mui' };
      }
      if (lower.includes('zcm')) {
        return { library: 'zcm' };
      }
      if (lower === 'csa-custom' || lower === 'custom') {
        return { library: 'csa-custom' };
      }
    }

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
