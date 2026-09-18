'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UIConfig, UILibrary, DEFAULT_UI_CONFIG } from './UIConfig';
import { UIRegistry } from './UIRegistry';
import { UIContext, UIContextValue } from './UIContext';
import { getCssVariablesForLibrary } from '../theme/resolveTheme';

export interface UIProviderProps {
  children: React.ReactNode;
  config?: UIConfig;
  onLibraryChange?: (library: UILibrary) => void;
}

export function UIProvider({
  children,
  config = DEFAULT_UI_CONFIG,
  onLibraryChange,
}: UIProviderProps) {
  const [activeLibrary, setActiveLibrary] = useState<UILibrary>(config.library);

  // Sync with prop if it changes externally
  useEffect(() => {
    if (config.library && config.library !== activeLibrary) {
      setActiveLibrary(config.library);
    }
  }, [config.library]);

  // Check URL param or local override in browser environment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLibrary = urlParams.get('ui') as UILibrary;
      const storedLibrary = localStorage.getItem('csa_ui_library') as UILibrary;

      const target = urlLibrary || storedLibrary;
      if (target && UIRegistry.hasAdapter(target)) {
        setActiveLibrary(target);
      }
    }
  }, []);

  const handleSetLibrary = (lib: UILibrary) => {
    setActiveLibrary(lib);
    if (typeof window !== 'undefined') {
      localStorage.setItem('csa_ui_library', lib);
    }
    onLibraryChange && onLibraryChange(lib);
  };

  const adapter = useMemo(() => {
    return UIRegistry.getAdapter(activeLibrary);
  }, [activeLibrary]);

  const cssVars = useMemo(() => {
    return getCssVariablesForLibrary(adapter.id);
  }, [adapter.id]);

  const contextValue: UIContextValue = useMemo(() => {
    return {
      activeLibrary: adapter.id,
      adapter,
      components: adapter.components,
      config: { ...config, library: adapter.id },
      setLibrary: handleSetLibrary,
    };
  }, [adapter, config]);

  const AdapterProvider = adapter.Provider;

  return (
    <UIContext.Provider value={contextValue}>
      <AdapterProvider themeConfig={config.theme}>
        <div
          id="csa-pluggable-ui-container"
          className="csa-pluggable-ui-container w-full min-h-full"
          style={cssVars as React.CSSProperties}
          data-active-ui={adapter.id}
          data-secondary-theme={adapter.secondaryColorName}
        >
          {children}
        </div>
      </AdapterProvider>
    </UIContext.Provider>
  );
}
