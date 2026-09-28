import React from 'react';
import { CSAUIComponentMap } from '../contracts';
import { UILibraryId, UIThemeConfig } from '../theme/types';

export interface UIAdapter {
  id: UILibraryId;
  name: string;
  secondaryColorName: string;
  secondaryColorHex: string;
  components: CSAUIComponentMap;
  Provider: React.ComponentType<{
    children: React.ReactNode;
    themeConfig?: UIThemeConfig;
  }>;
}
