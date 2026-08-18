import { csaTokens } from '../foundation/tokens';

const t = csaTokens;

/**
 * CSA Tailwind Preset — Single source for all Tailwind theme tokens.
 * Includes:
 *  - csa-* colors (brand yellow, navy, blue)
 *  - shadcn/ui color aliases (hsl CSS vars)
 *  - Meridian m-* legacy aliases
 *  - Typography, radius, shadows, animations
 */
export const csaTailwindPreset = {
  darkMode: ['class'] as const,
  theme: {
    extend: {
      colors: {

        /* ── CSA Brand Colors ───────────────────────────── */
        'csa-yellow': {
          50:  t.color.brand[50],
          100: t.color.brand[100],
          200: t.color.brand[200],
          300: t.color.brand[300],
          400: t.color.brand[400],
          500: t.color.brand[500],
          600: t.color.brand[600],
          700: t.color.brand[700],
          800: t.color.brand[800],
          900: t.color.brand[900],
          DEFAULT: t.color.brand.DEFAULT,
        },
        'csa-navy': {
          50:  t.color.navy[50],
          100: t.color.navy[100],
          200: t.color.navy[200],
          300: t.color.navy[300],
          400: t.color.navy[400],
          500: t.color.navy[500],
          600: t.color.navy[600],
          700: t.color.navy[700],
          800: t.color.navy[800],
          900: t.color.navy[900],
          950: t.color.navy[950],
          DEFAULT: t.color.navy.DEFAULT,
        },
        'csa-blue': {
          50:  t.color.blue[50],
          100: t.color.blue[100],
          200: t.color.blue[200],
          300: t.color.blue[300],
          400: t.color.blue[400],
          500: t.color.blue[500],
          600: t.color.blue[600],
          700: t.color.blue[700],
          800: t.color.blue[800],
          900: t.color.blue[900],
          DEFAULT: t.color.blue.DEFAULT,
        },

        /* ── shadcn/ui CSS-var Color Aliases ────────────── */
        /* These map to hsl(var(--*)) so shadcn components  */
        /* automatically use CSA colors.                    */
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT:             'hsl(var(--sidebar))',
          foreground:          'hsl(var(--sidebar-foreground))',
          primary:             'hsl(var(--sidebar-primary))',
          'primary-foreground':'hsl(var(--sidebar-primary-foreground))',
          accent:              'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border:              'hsl(var(--sidebar-border))',
          ring:                'hsl(var(--sidebar-ring))',
        },

        /* ── Meridian legacy aliases (m-*) ──────────────── */
        'm-primary': {
          50:  t.color.blue[50],
          100: t.color.blue[100],
          200: t.color.blue[200],
          DEFAULT: t.color.blue.DEFAULT,
          600: t.color.blue[600],
          700: t.color.blue[700],
        },
        'm-neutral': t.color.neutral,
        'm-surface': {
          DEFAULT: 'var(--color-surface-1)',
          1: 'var(--color-surface-1)',
          2: 'var(--color-surface-2)',
          3: 'var(--color-surface-3)',
          bg: 'var(--color-bg)',
        },
        'm-text': {
          DEFAULT:    'var(--color-ink)',
          2:          'var(--color-ink-soft)',
          muted:      'var(--color-text-muted)',
          subtle:     'var(--color-text-subtle)',
        },
        'm-border': {
          DEFAULT: 'var(--color-border)',
          strong:  'var(--color-border-strong)',
        },
        'm-success': {
          light:   t.color.success.light,
          border:  t.color.success.border,
          DEFAULT: t.color.success.base,
          dark:    t.color.success.dark,
        },
        'm-warning': {
          light:   t.color.warning.light,
          border:  t.color.warning.border,
          DEFAULT: t.color.warning.base,
          dark:    t.color.warning.dark,
        },
        'm-error': {
          light:   t.color.error.light,
          border:  t.color.error.border,
          DEFAULT: t.color.error.base,
          dark:    t.color.error.dark,
        },
        'm-info': {
          light:   t.color.info.light,
          border:  t.color.info.border,
          DEFAULT: t.color.info.base,
          dark:    t.color.info.dark,
        },
        'm-sidebar': {
          bg:            'var(--sidebar-bg)',
          text:          'var(--sidebar-text)',
          'text-hover':  'var(--sidebar-text-hover)',
          'text-active': 'var(--sidebar-text-active)',
          'item-hover':  'var(--sidebar-item-hover)',
          'item-active': 'var(--sidebar-item-active-bg)',
        },
      },

      fontFamily: {
        sans:    [t.typography.fontFamily.sans],
        mono:    [t.typography.fontFamily.mono],
        display: [t.typography.fontFamily.display],
      },

      fontSize: t.typography.fontSize,

      fontWeight: t.typography.fontWeight,

      lineHeight: t.typography.lineHeight,

      letterSpacing: t.typography.letterSpacing,

      borderRadius: {
        none:  t.radius.none,
        xs:    t.radius.xs,
        sm:    t.radius.sm,
        md:    t.radius.md,
        lg:    t.radius.lg,        // used by shadcn var(--radius)
        xl:    t.radius.xl,
        '2xl': t.radius['2xl'],
        '3xl': t.radius['3xl'],
        full:  t.radius.full,
        // Meridian legacy
        'm-sm':  t.radius.sm,
        'm-md':  t.radius.md,
        'm-lg':  t.radius.lg,
        'm-xl':  t.radius.xl,
        'm-2xl': t.radius['2xl'],
        'm-full':t.radius.full,
      },

      boxShadow: {
        xs:     t.shadow.xs,
        sm:     t.shadow.sm,
        md:     t.shadow.md,
        lg:     t.shadow.lg,
        xl:     t.shadow.xl,
        card:   t.shadow.card,
        panel:  t.shadow.panel,
        modal:  t.shadow.modal,
        focus:  t.shadow.focusRing,
        'focus-brand': t.shadow.focusBrand,
        primary: t.shadow.primary,
        brand:   t.shadow.brand,
        // Meridian legacy
        'm-xs':    t.shadow.xs,
        'm-sm':    t.shadow.sm,
        'm-md':    t.shadow.md,
        'm-lg':    t.shadow.lg,
        'm-xl':    t.shadow.xl,
        'm-card':  t.shadow.card,
        'm-panel': t.shadow.panel,
        'm-modal': t.shadow.modal,
        'm-focus': t.shadow.focusRing,
        'm-primary': t.shadow.primary,
      },

      transitionTimingFunction: {
        enterprise: t.animation.easing.enterprise,
        spring:     t.animation.easing.spring,
        'ease-out': t.animation.easing.out,
      },

      transitionDuration: {
        instant: t.animation.duration.instant,
        fast:    t.animation.duration.fast,
        base:    t.animation.duration.base,
        slow:    t.animation.duration.slow,
        slower:  t.animation.duration.slower,
      },

      zIndex: t.zIndex,

      screens: t.breakpoints,

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'slide-in-from-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'slide-out-to-right': {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to:   { opacity: '0' },
        },
        'zoom-in-95': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'zoom-out-95': {
          from: { opacity: '1', transform: 'scale(1)' },
          to:   { opacity: '0', transform: 'scale(0.95)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },

      animation: {
        'accordion-down':      'accordion-down 0.2s ease-out',
        'accordion-up':        'accordion-up 0.2s ease-out',
        'slide-in-right':      'slide-in-from-right 0.28s cubic-bezier(0.22,1,0.36,1)',
        'slide-out-right':     'slide-out-to-right 0.22s ease-in',
        'fade-in':             'fade-in 0.18s ease-out',
        'fade-out':            'fade-out 0.14s ease-in',
        'zoom-in':             'zoom-in-95 0.18s cubic-bezier(0.22,1,0.36,1)',
        'zoom-out':            'zoom-out-95 0.14s ease-in',
        'spin-slow':           'spin-slow 2s linear infinite',
        'pulse-soft':          'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
};

/** Legacy export */
export const meridianTailwindPreset = csaTailwindPreset;
