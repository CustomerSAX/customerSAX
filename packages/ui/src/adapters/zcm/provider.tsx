'use client';

import React from 'react';
import { MeridianProvider } from '../../providers/MeridianProvider';
import { getCssVariablesForLibrary } from '../../theme/resolveTheme';
import { UIThemeConfig } from '../../theme/types';

export function ZCMAdapterProvider({
  children,
}: {
  children: React.ReactNode;
  themeConfig?: UIThemeConfig;
}) {
  const cssVars = getCssVariablesForLibrary('zcm');

  return (
    <MeridianProvider defaultTheme="light">
      <div
        className="csa-ui-root csa-adapter-zcm w-full h-full"
        style={cssVars as React.CSSProperties}
        data-csa-adapter="zcm"
        data-secondary-color="green"
      >
        {children}
      </div>
    </MeridianProvider>
  );
}
