'use client';

import { useState } from 'react';
import { useUI } from './UIContext';
import { SUPPORTED_UI_LIBRARIES } from './UIConfig';

export interface DevUISwitcherProps {
  className?: string;
  compact?: boolean;
}

export function DevUISwitcher({ className, compact = false }: DevUISwitcherProps) {
  const ui = useUI();
  const activeLibrary = ui?.activeLibrary || 'csa-custom';
  const orgLibrary = ui?.orgLibrary || 'csa-custom';
  const isDevOverride = Boolean(ui?.isDevOverride);
  const setLibrary = ui?.setLibrary || (() => {});
  const clearDevOverride = ui?.clearDevOverride || (() => {});
  const [isOpen, setIsOpen] = useState(false);

  const currentLib = SUPPORTED_UI_LIBRARIES.find((lib) => lib.id === activeLibrary) || SUPPORTED_UI_LIBRARIES[0];
  const orgLib = SUPPORTED_UI_LIBRARIES.find((lib) => lib.id === orgLibrary) || SUPPORTED_UI_LIBRARIES[0];

  return (
    <div className={`relative inline-block text-left ${className || ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-gray-200 shadow-xs hover:bg-gray-50 focus:outline-none transition-all"
        title="Developer UI Testing Tool — Switch active UI adapter"
        id="csa-dev-ui-switcher"
      >
        <span
          className="w-2.5 h-2.5 rounded-full ring-2 ring-white"
          style={{ backgroundColor: currentLib.secondaryColorHex }}
        />
        <span className="text-gray-700 font-mono">
          {compact ? currentLib.id : `UI: ${currentLib.label}`}
        </span>
        {isDevOverride ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">
            DEV OVERRIDE
          </span>
        ) : (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: currentLib.secondaryColorHex }}
          >
            {currentLib.secondaryColorName}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="origin-top-right absolute right-0 mt-1 w-72 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 divide-y divide-gray-100 focus:outline-none animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3.5 py-2.5 bg-gray-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Dev UI Testing Tool
                </p>
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-200/80 px-1.5 py-0.5 rounded">
                  Testing Only
                </span>
              </div>
              <p className="mt-1 text-[10px] text-gray-500 leading-normal">
                Organization configuration is the source of truth. Use this switcher to test UI adapters locally.
              </p>
            </div>

            {/* Organization Source of Truth Status */}
            <div className="px-3.5 py-2.5 bg-blue-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-600">Org Theme:</span>
                <span className="text-[11px] font-bold text-gray-900 flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: orgLib.secondaryColorHex }}
                  />
                  {orgLib.label}
                </span>
              </div>

              {isDevOverride && (
                <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-amber-700">
                    ⚠️ Dev override active
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearDevOverride();
                      setIsOpen(false);
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    Reset to Org Theme
                  </button>
                </div>
              )}
            </div>

            <div className="p-1 space-y-0.5">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Switch UI Adapter (Temporary Override)
              </div>
              {SUPPORTED_UI_LIBRARIES.map((lib) => {
                const isSelected = lib.id === activeLibrary;
                return (
                  <button
                    key={lib.id}
                    type="button"
                    onClick={() => {
                      setLibrary(lib.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 text-blue-900 font-bold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lib.secondaryColorHex }}
                      />
                      <div>
                        <div>{lib.label}</div>
                        <div className="text-[10px] text-gray-500 font-normal">
                          Accent: {lib.secondaryColorName} ({lib.secondaryColorHex})
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-blue-600 font-bold text-sm">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
