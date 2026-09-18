'use client';

import { createContext, useContext } from 'react';
import type { UIAdapter } from '../adapters/types';
import type { CSAUIComponentMap } from '../contracts';
import type { UIConfig, UILibrary } from './UIConfig';

export interface UIContextValue {
  activeLibrary: UILibrary;
  adapter: UIAdapter;
  components: CSAUIComponentMap;
  config: UIConfig;
  setLibrary: (library: UILibrary) => void;
}

export const UIContext = createContext<UIContextValue | null>(null);

export function useUI(): UIContextValue | null {
  return useContext(UIContext);
}

export function useUIComponents(): CSAUIComponentMap | null {
  const ui = useUI();
  return ui ? ui.components : null;
}

export function useUIAdapter(): UIAdapter | null {
  const ui = useUI();
  return ui ? ui.adapter : null;
}
