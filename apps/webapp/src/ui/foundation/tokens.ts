/**
 * Meridian Design System — Design Tokens Single Source of Truth
 * CSA Platform v1.0.0
 */

export const meridianTokens = {
  meta: {
    name: 'Meridian Design System',
    product: 'CSA Platform',
    version: '1.0.0',
    description: 'Enterprise SaaS identity and design system tokens.',
  },

  color: {
    brand: {
      primary: {
        50: '#EEF1FE',
        100: '#D9DFFD',
        200: '#B3BFFB',
        300: '#8DA0F8',
        400: '#6780F5',
        500: '#4F6EF7',
        600: '#3A56D4',
        700: '#2A3FAF',
        800: '#1E2D8A',
        900: '#141F65',
        DEFAULT: '#4F6EF7',
      },
    },
    neutral: {
      0: '#FFFFFF',
      50: '#FAFBFC',
      100: '#F4F6F9',
      150: '#EBEFF4',
      200: '#E2E7EE',
      300: '#C8D0DC',
      400: '#A0ADBF',
      500: '#6B7A90',
      600: '#4A5568',
      700: '#2D3748',
      800: '#1A202C',
      900: '#111827',
      950: '#0E1117',
    },
    semantic: {
      success: {
        light: '#ECFDF5',
        border: '#A7F3D0',
        base: '#059669',
        dark: '#047857',
      },
      warning: {
        light: '#FFFBEB',
        border: '#FDE68A',
        base: '#D97706',
        dark: '#B45309',
      },
      error: {
        light: '#FEF2F2',
        border: '#FECACA',
        base: '#DC2626',
        dark: '#B91C1C',
      },
      info: {
        light: '#EFF6FF',
        border: '#BFDBFE',
        base: '#0284C7',
        dark: '#0369A1',
      },
    },
    surface: {
      'app-bg': '#FAFBFC',
      'surface-1': '#FFFFFF',
      'surface-2': '#F4F6F9',
      'surface-3': '#EBEFF4',
    },
    sidebar: {
      bg: '#0E1117',
      text: 'rgba(255,255,255,0.55)',
      'text-hover': 'rgba(255,255,255,0.88)',
      'text-active': '#FFFFFF',
      'item-hover': 'rgba(255,255,255,0.06)',
      'item-active': 'rgba(79,110,247,0.18)',
      accent: '#4F6EF7',
    },
    topbar: {
      bg: 'rgba(255,255,255,0.96)',
      border: '#E2E7EE',
    },
  },

  typography: {
    fontFamily: {
      sans: "'Inter', 'Segoe UI Variable', ui-sans-serif, system-ui, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    },
    fontSize: {
      '2xs': '10px',
      xs: '11px',
      sm: '12px',
      md: '13px',
      base: '14px',
      lg: '15px',
      xl: '18px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
    },
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    lineHeight: {
      none: '1',
      tight: '1.2',
      snug: '1.35',
      normal: '1.5',
      relaxed: '1.65',
    },
    letterSpacing: {
      tight: '-0.01em',
      normal: '0',
      wide: '0.04em',
      wider: '0.08em',
      widest: '0.14em',
    },
  },

  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    'page-x': 'clamp(24px, 3vw, 48px)',
    'page-y': 'clamp(24px, 2.5vw, 40px)',
  },

  borderRadius: {
    none: '0px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    full: '9999px',
  },

  shadow: {
    none: 'none',
    xs: '0 1px 2px rgba(17,24,39,0.04)',
    sm: '0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)',
    md: '0 4px 12px rgba(17,24,39,0.06), 0 1px 3px rgba(17,24,39,0.04)',
    lg: '0 8px 24px rgba(17,24,39,0.08), 0 2px 6px rgba(17,24,39,0.05)',
    xl: '0 20px 48px rgba(17,24,39,0.10), 0 4px 12px rgba(17,24,39,0.06)',
    card: '0 1px 3px rgba(17,24,39,0.05), 0 12px 30px -20px rgba(17,24,39,0.12)',
    panel: '0 1px 3px rgba(17,24,39,0.05), 0 20px 48px -30px rgba(17,24,39,0.16)',
    modal: '0 24px 64px -16px rgba(17,24,39,0.22), 0 4px 16px rgba(17,24,39,0.08)',
    focus: '0 0 0 3px rgba(79,110,247,0.18)',
    primary: '0 8px 20px -10px rgba(79,110,247,0.50)',
  },

  opacity: {
    0: '0',
    5: '0.05',
    10: '0.1',
    20: '0.2',
    25: '0.25',
    40: '0.4',
    50: '0.5',
    60: '0.6',
    75: '0.75',
    90: '0.9',
    100: '1',
  },

  blur: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '16px',
    xl: '24px',
  },

  animation: {
    duration: {
      instant: '80ms',
      fast: '140ms',
      base: '200ms',
      slow: '300ms',
      slower: '450ms',
    },
    easing: {
      linear: 'linear',
      ease: 'ease',
      enterprise: 'cubic-bezier(0.22, 1, 0.36, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },

  zIndex: {
    base: '0',
    raised: '10',
    dropdown: '100',
    sticky: '200',
    overlay: '500',
    modal: '1000',
    drawer: '1100',
    toast: '1200',
    tooltip: '1300',
  },

  breakpoints: {
    xs: '480px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  iconSizes: {
    xs: '12px',
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '32px',
  },

  componentDimensions: {
    sidebar: { width: '256px', widthCollapsed: '72px' },
    topbar: { height: '64px' },
    button: { heightSm: '32px', heightMd: '38px', heightLg: '44px' },
    input: { heightSm: '32px', heightMd: '38px', heightLg: '44px' },
  },
} as const;

export type MeridianTokens = typeof meridianTokens;
