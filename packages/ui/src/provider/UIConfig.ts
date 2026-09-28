import { UILibraryId, UIThemeConfig } from '../theme/types';

export type UILibrary = UILibraryId;

export interface UIConfig {
  library: UILibrary;
  theme?: UIThemeConfig;
}

export const ALLOWED_ORG_UI_THEMES = ['csa-custom', 'mantine', 'mui'] as const;
export type OrgUITheme = (typeof ALLOWED_ORG_UI_THEMES)[number];

export const DEFAULT_UI_CONFIG: UIConfig = {
  library: 'csa-custom',
};

export const SUPPORTED_UI_LIBRARIES: Array<{
  id: UILibrary;
  label: string;
  secondaryColorName: string;
  secondaryColorHex: string;
}> = [
  {
    id: 'csa-custom',
    label: 'CSA Custom (Tailwind)',
    secondaryColorName: 'slate',
    secondaryColorHex: '#64748B',
  },
  {
    id: 'mantine',
    label: 'Mantine UI',
    secondaryColorName: 'teal',
    secondaryColorHex: '#0D9488',
  },
  {
    id: 'mui',
    label: 'Material UI (MUI)',
    secondaryColorName: 'orange',
    secondaryColorHex: '#EA580C',
  },
  {
    id: 'zcm',
    label: 'ZCM (Scaffold)',
    secondaryColorName: 'green',
    secondaryColorHex: '#16A34A',
  },
];
