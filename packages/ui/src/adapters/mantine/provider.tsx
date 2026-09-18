'use client';

import React from 'react';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { resolveMantineTheme, getCssVariablesForLibrary } from '../../theme/resolveTheme';
import { UIThemeConfig } from '../../theme/types';

export function MantineAdapterProvider({
  children,
  themeConfig,
}: {
  children: React.ReactNode;
  themeConfig?: UIThemeConfig;
}) {
  const theme = resolveMantineTheme(themeConfig);
  const cssVars = getCssVariablesForLibrary('mantine');

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <div
        className="csa-ui-root csa-adapter-mantine w-full h-full"
        style={cssVars as React.CSSProperties}
        data-csa-adapter="mantine"
        data-secondary-color="teal"
      >
        {children}
      </div>
    </MantineProvider>
  );
}
