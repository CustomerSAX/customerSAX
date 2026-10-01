"use client";

import { useMemo } from "react";
import {
  Card,
  Icon,
  UIRegistry,
  UIContext,
  getCssVariablesForLibrary,
  type UIContextValue
} from "@csa/ui";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import { ProviderCard } from "../components/ProviderCard";
import { UI_THEME_OPTIONS } from "../constants";
import type { OnboardingState, UiThemeOption } from "../types";

interface Step2AppearanceProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

export function Step2Appearance({ state, onChange }: Step2AppearanceProps) {
  const currentTheme = (state.uiTheme || "csa-custom") as UiThemeOption;

  const handleSelectTheme = (uiTheme: UiThemeOption) => {
    onChange({ uiTheme });
  };

  const adapter = useMemo(() => {
    return UIRegistry.getAdapter(currentTheme);
  }, [currentTheme]);

  const AdapterProvider = adapter.Provider;
  const cssVars = useMemo(() => getCssVariablesForLibrary(adapter.id), [adapter.id]);

  const previewContextValue = useMemo<UIContextValue>(
    () => ({
      activeLibrary: adapter.id,
      adapter,
      components: adapter.components,
      config: { library: adapter.id },
      setLibrary: () => {},
      orgLibrary: adapter.id,
      isDevOverride: false,
      clearDevOverride: () => {}
    }),
    [adapter]
  );

  const { Button: PButton, Badge: PBadge, Input: PInput, Select: PSelect } = adapter.components;

  const activeOption = UI_THEME_OPTIONS.find((t) => t.id === currentTheme) || UI_THEME_OPTIONS[0];

  return (
    <OnboardingStepShell
      stepNumber={2}
      totalSteps={6}
      title="Appearance & Design System"
      description="Choose the UI component library used to render the CSA Studio interface for this organization. CSA's pluggable architecture allows each client to run on their preferred component framework."
      tip="This step is optional. If you make no changes, the organization will default to CSA Custom (Meridian / Tailwind CSS)."
    >
      <div className="flex flex-col gap-6">
        {/* Theme Selection Grid - 3 Columns (Custom, Mantine, Material) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {UI_THEME_OPTIONS.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <ProviderCard
                key={theme.id}
                id={theme.id}
                title={theme.name}
                badge={theme.badge}
                badgeTone={theme.id === "csa-custom" ? "primary" : "neutral"}
                description={theme.description}
                selected={isSelected}
                onClick={() => handleSelectTheme(theme.id)}
                icon="palette"
              >
                <div className="flex items-center justify-between pt-1 text-[11px] text-m-text-subtle font-mono">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: theme.tagColor }}
                    />
                    <span className="font-semibold text-m-text truncate">{theme.id}</span>
                  </div>
                  <span className="text-[10px] text-m-text-muted shrink-0 font-sans">adapter ready</span>
                </div>
              </ProviderCard>
            );
          })}
        </div>

        {/* Live UI Component Preview Sandbox */}
        <Card className="p-6 border border-m-border/80 bg-m-surface-subtle/30 shadow-m-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-m-border/60 pb-3 mb-5">
            <div className="flex items-center gap-2.5">
              <Icon name="eye" size="xs" className="text-m-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-m-text">
                Live Theme Preview — {activeOption.name}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-xs"
                style={{ backgroundColor: adapter.secondaryColorHex || activeOption.tagColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Secondary: {adapter.secondaryColorName}
              </span>
            </div>
            <span className="text-[11px] text-m-text-muted font-mono">
              @csa/ui/adapters/<span className="text-m-primary font-bold">{adapter.id}</span>
            </span>
          </div>

          {/* Scoped Adapter Provider Sandbox */}
          <UIContext.Provider value={previewContextValue}>
            <AdapterProvider key={currentTheme}>
              <div
                style={cssVars as React.CSSProperties}
                data-active-ui={adapter.id}
                data-secondary-theme={adapter.secondaryColorName}
                className="p-5 rounded-lg border border-m-border/70 bg-m-surface shadow-xs flex flex-col gap-6 transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Buttons Preview */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                        Interactive Buttons
                      </span>
                      <span className="text-[10px] text-m-text-subtle font-mono">{adapter.id}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PButton variant="primary" size="sm">
                        Primary
                      </PButton>
                      <PButton variant="secondary" size="sm">
                        Secondary
                      </PButton>
                      <PButton variant="outline" size="sm">
                        Outline
                      </PButton>
                    </div>
                  </div>

                  {/* Badges Preview */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                        Status Badges & Chips
                      </span>
                      <span className="text-[10px] text-m-text-subtle font-mono">{adapter.id}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PBadge variant="success" size="sm" dot>
                        Active
                      </PBadge>
                      <PBadge variant="primary" size="sm">
                        Synced
                      </PBadge>
                      <PBadge variant="neutral" size="sm">
                        Pending
                      </PBadge>
                    </div>
                  </div>

                  {/* Form Controls Preview */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                        Form Controls
                      </span>
                      <span className="text-[10px] text-m-text-subtle font-mono">{adapter.id}</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <PInput
                        placeholder="Search orders, customers..."
                        size="sm"
                        defaultValue="Sample search query"
                      />
                      <PSelect
                        size="sm"
                        defaultValue="usd"
                        options={[
                          { value: "usd", label: "USD ($) - US Dollar" },
                          { value: "eur", label: "EUR (€) - Euro" },
                          { value: "gbp", label: "GBP (£) - British Pound" }
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </AdapterProvider>
          </UIContext.Provider>
        </Card>
      </div>
    </OnboardingStepShell>
  );
}
