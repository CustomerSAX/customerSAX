/**
 * CustomerSAX Studio — Design Tokens (Single Source of Truth)
 * All Tailwind classes, CSS vars, and shadcn HSL vars derive from here.
 */

export const csaTokens = {
  meta: {
    name: 'CSA Design System',
    product: 'customerSAX Studio',
    version: '2.0.0',
  },

  color: {
    /** Yellow/Amber — brand accent, header, active nav item */
    brand: {
      50:  '#FFFBF0',
      100: '#FEF3D0',
      200: '#FDE59E',
      300: '#FCD162',
      400: '#FABD30',
      500: '#F5A624',   // primary brand yellow
      600: '#D48B0F',
      700: '#AA6E0A',
      800: '#815408',
      900: '#5A3B05',
      DEFAULT: '#F5A624',
    },

    /** Navy — sidebar, dark surfaces */
    navy: {
      50:  '#EEF0F8',
      100: '#D5D9EF',
      200: '#AAB2DE',
      300: '#7F8CCC',
      400: '#4F61B8',
      500: '#2A3D9C',
      600: '#1B2D80',
      700: '#0F1E68',
      800: '#0B1650',
      900: '#07103D',   // primary sidebar navy
      950: '#05082E',
      DEFAULT: '#07103D',
    },

    /** Blue — primary actions, links (light/bright royal blue) */
    blue: {
      50:  '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#2563EB',   // primary action blue — single theme knob
      600: '#1D4ED8',
      700: '#1E40AF',
      800: '#1E3A8A',
      900: '#172554',
      DEFAULT: '#2563EB',
    },

    /** Neutrals */
    neutral: {
      0:   '#FFFFFF',
      25:  '#FDFEFF',
      50:  '#F7F9FC',
      100: '#EEF2F7',
      150: '#E6EBF3',
      200: '#D8E0EA',
      300: '#BAC6D6',
      400: '#94A3B6',
      500: '#667085',
      600: '#4A5568',
      700: '#334155',
      800: '#1E293B',
      900: '#101828',
      950: '#0A1020',
    },

    /** Semantic */
    success: { light: '#ECFDF5', border: '#A7F3D0', base: '#059669', dark: '#047857' },
    warning: { light: '#FFFBEB', border: '#FDE68A', base: '#D97706', dark: '#B45309' },
    error:   { light: '#FEF2F2', border: '#FECACA', base: '#DC2626', dark: '#B91C1C' },
    info:    { light: '#EFF8FF', border: '#BAE6FD', base: '#0284C7', dark: '#0369A1' },
  },

  /** shadcn-compatible HSL values (used in styles.css :root block) */
  shadcn: {
    light: {
      background:         '0 0% 98%',          // #FAFAFA
      foreground:         '230 47% 9%',         // #07103D (navy)
      card:               '0 0% 100%',
      cardForeground:     '230 47% 9%',
      popover:            '0 0% 100%',
      popoverForeground:  '230 47% 9%',
      primary:            '221 83% 53%',        // #2563EB blue — primary action
      primaryForeground:  '0 0% 100%',          // white on blue
      secondary:          '216 28% 93%',        // light gray
      secondaryForeground:'230 47% 9%',
      muted:              '216 28% 93%',
      mutedForeground:    '215 16% 47%',
      accent:             '230 70% 14%',        // #07103D navy
      accentForeground:   '37 91% 55%',         // yellow on navy
      destructive:        '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border:             '214 20% 86%',
      input:              '214 20% 86%',
      ring:               '221 83% 53%',        // blue focus ring
      radius:             '0.625rem',           // 10px
      sidebar:            '221 83% 53%',        // #2563EB blue sidebar
      sidebarForeground:  '0 0% 100%',
      sidebarPrimary:     '37 91% 55%',         // yellow active (brand accent)
      sidebarPrimaryForeground: '230 47% 9%',
      sidebarAccent:      '221 83% 45%',        // darker blue hover
      sidebarAccentForeground: '0 0% 100%',
      sidebarBorder:      '221 60% 46%',
      sidebarRing:        '37 91% 55%',
    },
  },

  typography: {
    fontFamily: {
      sans: '"Inter Variable", "Inter", "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, "SF Mono", monospace',
      display: '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
    },
    fontSize: {
      '2xs': ['0.625rem',  { lineHeight: '1rem' }],
      'xs':  ['0.6875rem', { lineHeight: '1.125rem' }],
      'sm':  ['0.8125rem', { lineHeight: '1.25rem' }],
      'md':  ['0.875rem',  { lineHeight: '1.375rem' }],
      'base':['0.9375rem', { lineHeight: '1.5rem' }],
      'lg':  ['1rem',      { lineHeight: '1.625rem' }],
      'xl':  ['1.125rem',  { lineHeight: '1.75rem' }],
      '2xl': ['1.375rem',  { lineHeight: '1.875rem' }],
      '3xl': ['1.625rem',  { lineHeight: '2.125rem' }],
      '4xl': ['2rem',      { lineHeight: '2.5rem' }],
      '5xl': ['2.5rem',    { lineHeight: '1.15' }],
    },
    fontWeight: {
      regular:   '400',
      medium:    '500',
      semibold:  '600',
      bold:      '700',
      extrabold: '800',
    },
    lineHeight: {
      tight:   '1.15',
      snug:    '1.3',
      normal:  '1.5',
      relaxed: '1.65',
    },
    letterSpacing: {
      tighter: '-0.03em',
      tight:   '-0.02em',
      snug:    '-0.01em',
      normal:   '0em',
      wide:     '0.04em',
      wider:    '0.08em',
    },
  },

  radius: {
    none: '0px',
    xs:   '4px',
    sm:   '6px',
    md:   '8px',
    lg:   '10px',
    xl:   '12px',
    '2xl':'16px',
    '3xl':'20px',
    full: '9999px',
  },

  shadow: {
    xs:      '0 1px 2px rgba(10,16,32,0.04)',
    sm:      '0 1px 3px rgba(10,16,32,0.06), 0 1px 2px rgba(10,16,32,0.04)',
    md:      '0 4px 12px rgba(10,16,32,0.07), 0 1px 3px rgba(10,16,32,0.04)',
    lg:      '0 8px 24px rgba(10,16,32,0.09), 0 2px 6px rgba(10,16,32,0.05)',
    xl:      '0 20px 48px rgba(10,16,32,0.11), 0 4px 12px rgba(10,16,32,0.06)',
    card:    '0 1px 2px rgba(10,16,32,0.05), 0 8px 24px -16px rgba(10,16,32,0.12)',
    panel:   '0 1px 2px rgba(10,16,32,0.04), 0 16px 48px -24px rgba(10,16,32,0.16)',
    modal:   '0 20px 60px -16px rgba(10,16,32,0.24), 0 4px 16px rgba(10,16,32,0.08)',
    focusRing:   '0 0 0 3px rgba(37,99,235,0.22)',
    focusBrand:  '0 0 0 3px rgba(245,166,36,0.35)',
    primary:     '0 6px 18px -8px rgba(37,99,235,0.55)',
    brand:       '0 6px 18px -8px rgba(245,166,36,0.50)',
  },

  animation: {
    duration: {
      instant: '60ms',
      fast:    '120ms',
      base:    '180ms',
      slow:    '280ms',
      slower:  '420ms',
    },
    easing: {
      linear:     'linear',
      ease:       'ease',
      enterprise: 'cubic-bezier(0.22, 1, 0.36, 1)',
      spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
      out:        'cubic-bezier(0.0, 0.0, 0.2, 1)',
    },
  },

  zIndex: {
    base:    '0',
    raised:  '10',
    dropdown:'100',
    sticky:  '200',
    overlay: '300',
    modal:   '400',
    toast:   '500',
    tooltip: '600',
  },

  breakpoints: {
    xs:   '480px',
    sm:   '640px',
    md:   '768px',
    lg:   '1024px',
    xl:   '1280px',
    '2xl':'1536px',
  },

  componentDimensions: {
    sidebar:  { width: '240px', widthCollapsed: '64px' },
    topbar:   { height: '52px' },
    button:   { heightSm: '32px', heightMd: '38px', heightLg: '44px' },
    input:    { heightSm: '32px', heightMd: '38px', heightLg: '44px' },
  },
} as const;

/** Legacy export — keeps existing imports working */
export const meridianTokens = csaTokens;

export type CSATokens = typeof csaTokens;
export type MeridianTokens = typeof csaTokens;
