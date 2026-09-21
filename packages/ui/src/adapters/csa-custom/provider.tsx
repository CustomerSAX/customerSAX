'use client';

import React from 'react';
import { MeridianProvider } from '../../providers/MeridianProvider';
import { getCssVariablesForLibrary } from '../../theme/resolveTheme';
import { UIThemeConfig } from '../../theme/types';

export function CSACustomAdapterProvider({
  children,
}: {
  children: React.ReactNode;
  themeConfig?: UIThemeConfig;
}) {
  const cssVars = getCssVariablesForLibrary('csa-custom');

  return (
    <MeridianProvider defaultTheme="light">
      <div
        className="csa-ui-root csa-adapter-csa-custom w-full h-full"
        style={cssVars as React.CSSProperties}
        data-csa-adapter="csa-custom"
        data-secondary-color="slate"
      >
        {children}
      </div>
    </MeridianProvider>
  );
}
