import { describe, it, expect } from 'vitest';
import {
  UIRegistry,
  resolveUIConfig,
  SUPPORTED_UI_LIBRARIES,
  ALLOWED_ORG_UI_THEMES,
  getTokensForLibrary,
  ADAPTER_SECONDARY_COLORS,
  CSA_BASE_PRIMARY,
  csaCustomAdapter,
  mantineAdapter,
  muiAdapter,
  zcmAdapter,
} from './index';

describe('CSA Pluggable Multi-UI Architecture', () => {
  it('registers all 4 adapters and exposes supported library options', () => {
    const adapters = UIRegistry.listAdapters();
    expect(adapters.length).toBe(4);
    expect(UIRegistry.hasAdapter('csa-custom')).toBe(true);
    expect(UIRegistry.hasAdapter('mantine')).toBe(true);
    expect(UIRegistry.hasAdapter('mui')).toBe(true);
    expect(UIRegistry.hasAdapter('zcm')).toBe(true);
    expect(SUPPORTED_UI_LIBRARIES.length).toBe(4);
    expect(ALLOWED_ORG_UI_THEMES).toEqual(['csa-custom', 'mantine', 'mui']);
  });

  it('safely falls back to csa-custom for unknown libraries', () => {
    const fallback = UIRegistry.getAdapter('non-existent-ui' as any);
    expect(fallback.id).toBe('csa-custom');
  });

  it('strictly preserves the existing primary color across all adapters', () => {
    const libraries = ['csa-custom', 'mantine', 'mui', 'zcm'] as const;
    libraries.forEach((lib) => {
      const tokens = getTokensForLibrary(lib);
      expect(tokens.colors.primary).toBe(CSA_BASE_PRIMARY);
      expect(tokens.colors.primary).toBe('#2563EB');
    });
  });

  it('provides distinct secondary colors according to requirements', () => {
    // csa-custom: existing slate
    expect(ADAPTER_SECONDARY_COLORS['csa-custom'].name).toBe('slate');
    expect(ADAPTER_SECONDARY_COLORS['csa-custom'].base).toBe('#64748B');

    // mantine: teal
    expect(ADAPTER_SECONDARY_COLORS['mantine'].name).toBe('teal');
    expect(ADAPTER_SECONDARY_COLORS['mantine'].base).toBe('#0D9488');

    // mui: orange
    expect(ADAPTER_SECONDARY_COLORS['mui'].name).toBe('orange');
    expect(ADAPTER_SECONDARY_COLORS['mui'].base).toBe('#EA580C');

    // zcm: green
    expect(ADAPTER_SECONDARY_COLORS['zcm'].name).toBe('green');
    expect(ADAPTER_SECONDARY_COLORS['zcm'].base).toBe('#16A34A');
  });

  it('resolves UI configuration by project or customer key', () => {
    expect(resolveUIConfig({ projectId: 'tenant-custom' }).library).toBe('csa-custom');
    expect(resolveUIConfig({ projectId: 'project-mantine-1' }).library).toBe('mantine');
    expect(resolveUIConfig({ projectId: 'client-mui' }).library).toBe('mui');
    expect(resolveUIConfig({ customerId: 'customer-d' }).library).toBe('zcm');
    expect(resolveUIConfig({ projectId: 'unrecognized-tenant' }).library).toBe('csa-custom');
  });

  it('resolves organization-based UI themes for Royal Cyber, Direct Wines, and defaults', () => {
    // Royal Cyber -> mantine
    expect(resolveUIConfig({ organizationName: 'Royal Cyber' }).library).toBe('mantine');
    expect(resolveUIConfig({ customerId: 'royal-cyber' }).library).toBe('mantine');
    expect(resolveUIConfig({ user: { activeClientId: 'royal-cyber' } }).library).toBe('mantine');

    // Direct Wines -> mui
    expect(resolveUIConfig({ organizationName: 'Direct Wines' }).library).toBe('mui');
    expect(resolveUIConfig({ customerId: 'direct-wines' }).library).toBe('mui');
    expect(resolveUIConfig({ user: { activeClientId: 'direct-wines' } }).library).toBe('mui');

    // User with explicit organization uiTheme in session
    expect(resolveUIConfig({ user: { uiTheme: 'mantine' } }).library).toBe('mantine');
    expect(resolveUIConfig({ user: { organization: { id: 'org-1', uiTheme: 'mui' } } }).library).toBe('mui');
    expect(
      resolveUIConfig({
        user: {
          tenantId: 'csa',
          activeProjectKey: 'rc_b2b_shop_july_2023',
          organization: { id: '69fe23700e3e8b804372427a', uiTheme: 'mui' }
        }
      }).library
    ).toBe('mui');

    // Default / another organization -> csa-custom
    expect(resolveUIConfig({ organizationName: 'Acme General' }).library).toBe('csa-custom');
    expect(resolveUIConfig({ user: { activeClientId: 'unknown-client' } }).library).toBe('csa-custom');

    // Invalid theme safely falls back to csa-custom
    expect(resolveUIConfig({ user: { uiTheme: 'invalid-framework' as any } }).library).toBe('csa-custom');
  });


  it('contains full component contracts for all 4 adapters', () => {
    const adapters = [csaCustomAdapter, mantineAdapter, muiAdapter, zcmAdapter];
    const contractKeys = [
      'Button',
      'IconButton',
      'Input',
      'TextArea',
      'SearchBar',
      'Select',
      'Checkbox',
      'Radio',
      'RadioGroup',
      'Switch',
      'Label',
      'FormField',
      'Separator',
      'Text',
      'Heading',
      'Modal',
      'Drawer',
      'Dropdown',
      'Popover',
      'Tooltip',
      'Toast',
      'Table',
      'Pagination',
      'Badge',
      'Chip',
      'Avatar',
      'Card',
      'Skeleton',
      'Loader',
      'EmptyState',
      'Tabs',
      'Breadcrumbs',
      'Accordion',
      'PageHeader',
      'PageShell',
      'Panel',
      'Toolbar',
      'StickyActionBar',
    ] as const;

    adapters.forEach((adapter) => {
      expect(adapter.Provider).toBeDefined();
      contractKeys.forEach((key) => {
        expect(adapter.components[key]).toBeDefined();
      });
    });
  });
});
