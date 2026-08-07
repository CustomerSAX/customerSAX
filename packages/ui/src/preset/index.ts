import { meridianTokens } from '../foundation/tokens';

/**
 * Reusable Tailwind CSS Preset for Meridian Design System
 */
export const meridianTailwindPreset = {
  theme: {
    extend: {
      colors: {
        'm-primary': {
          50: meridianTokens.color.brand.primary[50],
          100: meridianTokens.color.brand.primary[100],
          200: meridianTokens.color.brand.primary[200],
          300: meridianTokens.color.brand.primary[300],
          400: meridianTokens.color.brand.primary[400],
          500: meridianTokens.color.brand.primary[500],
          600: meridianTokens.color.brand.primary[600],
          700: meridianTokens.color.brand.primary[700],
          800: meridianTokens.color.brand.primary[800],
          900: meridianTokens.color.brand.primary[900],
          DEFAULT: meridianTokens.color.brand.primary.DEFAULT,
        },
        'm-neutral': meridianTokens.color.neutral,
        'm-surface': {
          DEFAULT: 'var(--m-surface-1)',
          1: 'var(--m-surface-1)',
          2: 'var(--m-surface-2)',
          3: 'var(--m-surface-3)',
          bg: 'var(--m-bg)',
        },
        'm-text': {
          DEFAULT: 'var(--m-text)',
          2: 'var(--m-text-2)',
          muted: 'var(--m-text-muted)',
          subtle: 'var(--m-text-subtle)',
        },
        'm-border': {
          DEFAULT: 'var(--m-border)',
          strong: 'var(--m-border-strong)',
        },
        'm-success': {
          light: meridianTokens.color.semantic.success.light,
          border: meridianTokens.color.semantic.success.border,
          DEFAULT: meridianTokens.color.semantic.success.base,
          dark: meridianTokens.color.semantic.success.dark,
        },
        'm-warning': {
          light: meridianTokens.color.semantic.warning.light,
          border: meridianTokens.color.semantic.warning.border,
          DEFAULT: meridianTokens.color.semantic.warning.base,
          dark: meridianTokens.color.semantic.warning.dark,
        },
        'm-error': {
          light: meridianTokens.color.semantic.error.light,
          border: meridianTokens.color.semantic.error.border,
          DEFAULT: meridianTokens.color.semantic.error.base,
          dark: meridianTokens.color.semantic.error.dark,
        },
        'm-info': {
          light: meridianTokens.color.semantic.info.light,
          border: meridianTokens.color.semantic.info.border,
          DEFAULT: meridianTokens.color.semantic.info.base,
          dark: meridianTokens.color.semantic.info.dark,
        },
        'm-sidebar': {
          bg: 'var(--m-sidebar-bg)',
          text: 'var(--m-sidebar-text)',
          'text-hover': 'var(--m-sidebar-text-hover)',
          'text-active': 'var(--m-sidebar-text-active)',
          'item-hover': 'var(--m-sidebar-item-hover)',
          'item-active': 'var(--m-sidebar-item-active)',
        },
      },
      fontFamily: {
        sans: [meridianTokens.typography.fontFamily.sans],
        mono: [meridianTokens.typography.fontFamily.mono],
      },
      fontSize: meridianTokens.typography.fontSize,
      fontWeight: meridianTokens.typography.fontWeight,
      lineHeight: meridianTokens.typography.lineHeight,
      letterSpacing: meridianTokens.typography.letterSpacing,
      borderRadius: {
        'm-sm': 'var(--m-r-sm)',
        'm-md': 'var(--m-r-md)',
        'm-lg': 'var(--m-r-lg)',
        'm-xl': 'var(--m-r-xl)',
        'm-2xl': 'var(--m-r-2xl)',
        'm-full': 'var(--m-r-full)',
      },
      boxShadow: {
        'm-xs': 'var(--m-shadow-xs)',
        'm-sm': 'var(--m-shadow-sm)',
        'm-md': 'var(--m-shadow-md)',
        'm-lg': 'var(--m-shadow-lg)',
        'm-xl': 'var(--m-shadow-xl)',
        'm-card': 'var(--m-shadow-card)',
        'm-panel': 'var(--m-shadow-panel)',
        'm-modal': 'var(--m-shadow-modal)',
        'm-focus': 'var(--m-shadow-focus)',
        'm-primary': 'var(--m-shadow-primary)',
      },
      transitionTimingFunction: {
        enterprise: 'var(--m-ease-enterprise)',
        spring: 'var(--m-ease-spring)',
      },
      transitionDuration: {
        instant: 'var(--m-t-instant)',
        fast: 'var(--m-t-fast)',
        base: 'var(--m-t-base)',
        slow: 'var(--m-t-slow)',
        slower: 'var(--m-t-slower)',
      },
      zIndex: meridianTokens.zIndex,
      screens: meridianTokens.breakpoints,
    },
  },
};
