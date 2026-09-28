export type UILibraryId = 'csa-custom' | 'mantine' | 'mui' | 'zcm';

export interface UIThemeTokens {
  colors: {
    primary: string;
    primaryHover: string;
    secondary: string;
    secondaryHover: string;
    secondaryLight: string;
    brand: string;
    background: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    border: string;
    borderStrong: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    baseFontSize: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  spacing: Record<string, string>;
}

export interface UIThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  radius?: string;
}
