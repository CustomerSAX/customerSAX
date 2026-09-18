import { createTheme as createMantineTheme, MantineThemeOverride } from '@mantine/core';
import { createTheme as createMuiTheme, Theme as MuiTheme } from '@mui/material/styles';
import { getTokensForLibrary, ADAPTER_SECONDARY_COLORS, CSA_BASE_PRIMARY } from './tokens';
import { UILibraryId, UIThemeConfig } from './types';

export function resolveMantineTheme(config?: UIThemeConfig): MantineThemeOverride {
  const tokens = getTokensForLibrary('mantine');

  return createMantineTheme({
    primaryColor: 'blue',
    colors: {
      blue: [
        '#EFF6FF',
        '#DBEAFE',
        '#BFDBFE',
        '#93C5FD',
        '#60A5FA',
        '#2563EB', // Primary
        '#1D4ED8',
        '#1E40AF',
        '#1E3A8A',
        '#172554',
      ],
      teal: [
        '#F0FDFA',
        '#CCFBF1',
        '#99F6E4',
        '#5EEAD4',
        '#2DD4BF',
        '#14B8A6',
        '#0D9488', // Teal secondary
        '#0F766E',
        '#115E59',
        '#134E4A',
      ],
    },
    defaultRadius: 'md',
    fontFamily: config?.fontFamily || tokens.typography.fontFamily,
    components: {
      Button: {
        defaultProps: {
          radius: 'md',
        },
      },
    },
  });
}

export function resolveMuiTheme(config?: UIThemeConfig): MuiTheme {
  const tokens = getTokensForLibrary('mui');
  const secondaryColor = config?.secondaryColor || tokens.colors.secondary;

  return createMuiTheme({
    palette: {
      primary: {
        main: CSA_BASE_PRIMARY,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: secondaryColor, // Orange secondary (#EA580C)
        contrastText: '#FFFFFF',
      },
      background: {
        default: tokens.colors.background,
        paper: tokens.colors.surface,
      },
      text: {
        primary: tokens.colors.text,
        secondary: tokens.colors.textMuted,
      },
      divider: tokens.colors.border,
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: config?.fontFamily || tokens.typography.fontFamily,
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
  });
}

export function getCssVariablesForLibrary(library: UILibraryId): Record<string, string> {
  const tokens = getTokensForLibrary(library);
  const secondary = ADAPTER_SECONDARY_COLORS[library];

  return {
    '--csa-ui-primary': tokens.colors.primary,
    '--csa-ui-primary-hover': tokens.colors.primaryHover,
    '--csa-ui-secondary': tokens.colors.secondary,
    '--csa-ui-secondary-hover': tokens.colors.secondaryHover,
    '--csa-ui-secondary-light': tokens.colors.secondaryLight,
    '--csa-ui-secondary-name': secondary.name,
    '--csa-ui-brand': tokens.colors.brand,
    '--csa-ui-border': tokens.colors.border,
    '--csa-ui-surface': tokens.colors.surface,
    '--csa-ui-text': tokens.colors.text,
    '--csa-ui-text-muted': tokens.colors.textMuted,
  };
}
