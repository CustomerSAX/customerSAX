import { UIThemeTokens, UILibraryId } from './types';

// Existing primary and brand colors (PRESERVED UNCHANGED)
export const CSA_BASE_PRIMARY = '#2563EB';
export const CSA_BASE_PRIMARY_HOVER = '#1D4ED8';
export const CSA_BASE_BRAND = '#F5A624';

// Adapter-specific secondary color definitions
export const ADAPTER_SECONDARY_COLORS: Record<
  UILibraryId,
  { base: string; hover: string; light: string; name: string }
> = {
  'csa-custom': {
    name: 'slate',
    base: '#64748B',
    hover: '#475569',
    light: '#F1F5F9',
  },
  mantine: {
    name: 'teal',
    base: '#0D9488',
    hover: '#0F766E',
    light: '#CCFBF1',
  },
  mui: {
    name: 'orange',
    base: '#EA580C',
    hover: '#C2410C',
    light: '#FFEDD5',
  },
  zcm: {
    name: 'green',
    base: '#16A34A',
    hover: '#15803D',
    light: '#DCFCE7',
  },
};

export function getTokensForLibrary(library: UILibraryId): UIThemeTokens {
  const secondary = ADAPTER_SECONDARY_COLORS[library] || ADAPTER_SECONDARY_COLORS['csa-custom'];

  return {
    colors: {
      primary: CSA_BASE_PRIMARY,
      primaryHover: CSA_BASE_PRIMARY_HOVER,
      secondary: secondary.base,
      secondaryHover: secondary.hover,
      secondaryLight: secondary.light,
      brand: CSA_BASE_BRAND,
      background: '#F8F9FC',
      surface: '#FFFFFF',
      surfaceAlt: '#F1F5F9',
      text: '#07103D',
      textMuted: '#667085',
      border: '#E3E8F0',
      borderStrong: '#CBD5E1',
      success: '#16A66A',
      warning: '#F59E0B',
      error: '#E5484D',
      info: '#0284C7',
    },
    typography: {
      fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      baseFontSize: '14px',
    },
    radius: {
      sm: '4px',
      md: '6px',
      lg: '10px',
      full: '9999px',
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
  };
}
