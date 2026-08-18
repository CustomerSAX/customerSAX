'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { meridianTokens, MeridianTokens } from '../foundation/tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface MeridianThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  tokens: MeridianTokens;
}

const MeridianThemeContext = createContext<MeridianThemeContextType | undefined>(
  undefined,
);

export interface MeridianProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
  tokensOverride?: Partial<MeridianTokens>;
}

export function MeridianProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'meridian-theme',
  tokensOverride,
}: MeridianProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemeState(stored);
    }
  }, [storageKey]);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (targetTheme: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(targetTheme);
      root.setAttribute('data-theme', targetTheme);
      setResolvedTheme(targetTheme);
    };

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemDark ? 'dark' : 'light');

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newTheme);
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };

  const tokens = tokensOverride
    ? { ...meridianTokens, ...tokensOverride }
    : meridianTokens;

  return (
    <MeridianThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        tokens,
      }}
    >
      {children}
    </MeridianThemeContext.Provider>
  );
}

export function useTheme(): MeridianThemeContextType {
  const context = useContext(MeridianThemeContext);
  if (!context) {
    // Fallback if not inside MeridianProvider
    return {
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
      tokens: meridianTokens,
    };
  }
  return context;
}
