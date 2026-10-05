"use client";

import { useState } from "react";
import { Badge, Button, Card, Icon } from "@csa/ui";
import { CONNECTOR_CATEGORIES, type ConnectorCategoryKey, type ConnectorConfig } from "../connectors.config";
import { ConnectorConfigModal } from "../components/ConnectorConfigModal";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import { getProviderLogo } from "../components/ProviderLogo";
import type { OnboardingState } from "../types";

interface Step4ConnectorsProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

export function Step4Connectors({ state, onChange }: Step4ConnectorsProps) {
  // Accordion state: by default, Product Search and Ticketing are open
  const [expandedCategories, setExpandedCategories] = useState<Record<ConnectorCategoryKey, boolean>>({
    "product-search": true,
    "ticketing": true,
    "payments": false,
    "ai": false,
    "communication": false,
    "sso": false,
    "crm": false
  });

  // Modal state
  const [selectedConnector, setSelectedConnector] = useState<ConnectorConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleCategory = (categoryKey: ConnectorCategoryKey) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const handleOpenConnector = (connector: ConnectorConfig) => {
    setSelectedConnector(connector);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedConnector(null);
  };

  const handleSaveConnector = (patch: Partial<OnboardingState>) => {
    onChange(patch);
  };

  return (
    <OnboardingStepShell
      stepNumber={4}
      totalSteps={6}
      title="Connectors & Integrations"
      description="Manage all third-party integrations from a single place. If no third-party connector is configured, CSA automatically utilizes high-performance native platform capabilities with zero setup."
      tip="Third-party connectors are optional. When unconfigured, Native Commerce Search, Native Ticketing, and Direct Auth remain active automatically."
    >
      <div className="flex flex-col gap-5">
        {CONNECTOR_CATEGORIES.map((category) => {
          const isExpanded = expandedCategories[category.id] ?? false;

          // Find active/configured connector in this category (if any)
          const activeConnector = category.connectors.find((c) =>
            c.isConfigured ? c.isConfigured(state) : false
          );
          const isNativeActive = !activeConnector;

          return (
            <Card
              key={category.id}
              className="border border-m-border bg-m-surface overflow-hidden shadow-m-card transition-all"
            >
              {/* Category Collapsible Header */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-m-surface-subtle/50 select-none"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-m-lg transition-colors ${
                      activeConnector
                        ? "bg-m-primary text-white"
                        : "bg-m-neutral-100 text-m-text"
                    }`}
                  >
                    <Icon name={category.icon} size="sm" />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-m-text tracking-tight">{category.name}</span>
                      {category.badge && (
                        <Badge variant="neutral" appearance="subtle" size="sm" className="hidden sm:inline-flex text-[10px]">
                          {category.badge}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-m-text-muted truncate max-w-md">
                      {category.description}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {/* Status Indicator */}
                  {activeConnector ? (
                    <Badge variant="success" size="sm" className="font-semibold">
                      {activeConnector.name} Active
                    </Badge>
                  ) : (
                    <Badge variant="neutral" appearance="subtle" size="sm" className="text-m-text-muted">
                      Native Active (Default)
                    </Badge>
                  )}

                  <div className="p-1 text-m-text-muted">
                    <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size="xs" />
                  </div>
                </div>
              </div>

              {/* Collapsible Content Area */}
              {isExpanded && (
                <div className="border-t border-m-border/60 bg-m-neutral-50/40 p-5 flex flex-col gap-4">
                  {/* Native Integration Status Banner */}
                  <div
                    className={`flex items-start gap-3 rounded-m-lg border p-3.5 text-xs transition-colors ${
                      isNativeActive
                        ? "border-m-success-border bg-m-success-light/40 text-m-text"
                        : "border-m-border/80 bg-white text-m-text-muted"
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-full p-1 shrink-0 ${
                        isNativeActive ? "bg-m-success-light text-m-success" : "bg-m-neutral-100 text-m-text-muted"
                      }`}
                    >
                      <Icon name={isNativeActive ? "check-circle-2" : "info"} size="xs" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-m-text">
                          {isNativeActive ? `${category.nativeIntegration.name} is Active (Default)` : `Default: ${category.nativeIntegration.name}`}
                        </span>
                        {isNativeActive && (
                          <span className="rounded bg-m-success/15 text-m-success text-[10px] font-bold px-1.5 py-0.2">
                            Zero Config
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {isNativeActive
                          ? category.nativeIntegration.description
                          : `Currently superseded by ${activeConnector?.name}. Disconnecting will seamlessly revert back to ${category.nativeIntegration.name}.`}
                      </p>
                    </div>
                  </div>

                  {/* Connectors Card Grid */}
                  <div>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-m-text-subtle">
                      Available Connectors
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {category.connectors.map((connector) => {
                        const isConfigured = connector.isConfigured ? connector.isConfigured(state) : false;
                        const summary = connector.getConfigSummary ? connector.getConfigSummary(state) : null;
                        const logo = getProviderLogo(connector.id);

                        return (
                          <div
                            key={connector.id}
                            onClick={() => handleOpenConnector(connector)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleOpenConnector(connector);
                              }
                            }}
                            className={`group relative flex flex-col justify-between rounded-m-xl border p-4 text-left transition-all ${
                              !connector.isAvailable
                                ? "cursor-pointer border-dashed border-m-border bg-m-surface/60 hover:border-m-border-strong opacity-85"
                                : isConfigured
                                  ? "cursor-pointer border-m-primary bg-m-primary-50/40 ring-2 ring-m-primary/20 shadow-m-card"
                                  : "cursor-pointer border-m-border bg-m-surface hover:border-m-primary/60 hover:shadow-m-card"
                            }`}
                          >
                            <div className="flex flex-col gap-2.5">
                              {/* Top row: Logo, Name, Badge, Status */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-m-lg border transition-all p-1 ${
                                      isConfigured
                                        ? "border-m-primary/50 bg-white ring-1 ring-m-primary/30 shadow-xs"
                                        : "border-m-border bg-white group-hover:border-m-primary/40 shadow-xs"
                                    }`}
                                  >
                                    {logo || (connector.icon ? <Icon name={connector.icon} size="xs" /> : <Icon name="layers" size="xs" />)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-m-text truncate">{connector.name}</span>
                                    </div>
                                    {connector.badge && (
                                      <span className="text-[10px] text-m-text-subtle font-medium block">
                                        {connector.badge}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  {isConfigured ? (
                                    <Badge variant="success" size="sm" className="font-semibold text-[10px]">
                                      Connected
                                    </Badge>
                                  ) : !connector.isAvailable ? (
                                    <Badge variant="neutral" appearance="subtle" size="sm" className="text-[10px]">
                                      Roadmap
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-m-text-subtle group-hover:text-m-primary">
                                      Not set
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Description */}
                              <p className="text-[11px] leading-relaxed text-m-text-muted line-clamp-2">
                                {connector.description}
                              </p>

                              {/* Configured Summary */}
                              {isConfigured && summary && (
                                <div className="rounded bg-white/80 border border-m-primary/20 px-2 py-1 font-mono text-[10px] text-m-primary truncate">
                                  {summary}
                                </div>
                              )}
                            </div>

                            {/* Card Footer Action */}
                            <div className="mt-3 pt-2.5 border-t border-m-border/60 flex items-center justify-between text-xs">
                              <span className="text-[11px] text-m-text-muted">
                                {isConfigured ? "Active" : connector.isAvailable ? "Click to configure" : "Upcoming"}
                              </span>

                              {connector.isAvailable ? (
                                <Button
                                  type="button"
                                  variant={isConfigured ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenConnector(connector);
                                  }}
                                  leftIcon={<Icon name={isConfigured ? "edit-2" : "settings"} size="xs" />}
                                >
                                  {isConfigured ? "Edit" : "Configure"}
                                </Button>
                              ) : (
                                <span className="text-[10px] text-m-text-subtle italic">Info</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Interactive Connector Configuration Modal */}
      <ConnectorConfigModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        connector={selectedConnector}
        state={state}
        onSave={handleSaveConnector}
      />
    </OnboardingStepShell>
  );
}
