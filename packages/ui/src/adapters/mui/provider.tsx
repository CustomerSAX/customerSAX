'use client';

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { resolveMuiTheme, getCssVariablesForLibrary } from '../../theme/resolveTheme';
import { UIThemeConfig } from '../../theme/types';

export function MUIAdapterProvider({
  children,
  themeConfig,
}: {
  children: React.ReactNode;
  themeConfig?: UIThemeConfig;
}) {
  const theme = resolveMuiTheme(themeConfig);
  const cssVars = getCssVariablesForLibrary('mui');

  return (
    <ThemeProvider theme={theme}>
      <div
        className="csa-ui-root csa-adapter-mui w-full h-full"
        style={cssVars as React.CSSProperties}
        data-csa-adapter="mui"
        data-secondary-color="orange"
      >
        {children}
      </div>
    </ThemeProvider>
  );
}
