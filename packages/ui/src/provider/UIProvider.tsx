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
  const [hasDevOverride, setHasDevOverride] = useState<boolean>(false);

  // Sync with prop if it changes externally (e.g., once user/organization loads)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlUi = urlParams.get('ui') as UILibrary;
      const devOverride = localStorage.getItem('csa_dev_ui_override') as UILibrary;

      // If developer override or URL override is active, keep it
      if ((urlUi && UIRegistry.hasAdapter(urlUi)) || (devOverride && UIRegistry.hasAdapter(devOverride))) {
        setHasDevOverride(true);
        return;
      }
    }

    setHasDevOverride(false);
    if (config.library && config.library !== activeLibrary) {
      setActiveLibrary(config.library);
    }
  }, [config.library]);

  // Check URL param or developer testing override in browser environment on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLibrary = urlParams.get('ui') as UILibrary;
      const devOverride = localStorage.getItem('csa_dev_ui_override') as UILibrary;

      if (urlLibrary && UIRegistry.hasAdapter(urlLibrary)) {
        setActiveLibrary(urlLibrary);
        setHasDevOverride(true);
        return;
      }

      if (devOverride && UIRegistry.hasAdapter(devOverride)) {
        setActiveLibrary(devOverride);
        setHasDevOverride(true);
        return;
      }

      // Organization theme is the source of truth
      setHasDevOverride(false);
      if (config.library && UIRegistry.hasAdapter(config.library)) {
        setActiveLibrary(config.library);
        try {
          localStorage.setItem('csa_org_ui_theme', config.library);
        } catch {
          // ignore
        }
      }
    }
  }, [config.library]);

  const handleSetLibrary = (lib: UILibrary) => {
    setActiveLibrary(lib);
    setHasDevOverride(true);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('csa_dev_ui_override', lib);
        localStorage.setItem('csa_ui_library', lib);
      } catch {
        // ignore
      }
    }
    onLibraryChange && onLibraryChange(lib);
  };

  const handleClearDevOverride = () => {
    setHasDevOverride(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('csa_dev_ui_override');
        localStorage.removeItem('csa_ui_library');
      } catch {
        // ignore
      }
    }
    const orgTarget = config.library || 'csa-custom';
    setActiveLibrary(orgTarget);
    onLibraryChange && onLibraryChange(orgTarget);
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
      orgLibrary: config.library,
      isDevOverride: hasDevOverride,
      clearDevOverride: handleClearDevOverride,
    };
  }, [adapter, config, hasDevOverride]);

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
