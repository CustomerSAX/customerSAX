"use client";

import { ADMIN_TEST_PROJECT_CREDENTIALS } from "@/features/superadmin/api/queries";
import { useMutation } from "@apollo/client";
import { Badge, Button, Card, Icon, Input, Select } from "@csa/ui";
import { useState } from "react";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import { ProviderCard } from "../components/ProviderCard";
import { COMMERCE_PLATFORMS, INITIAL_PROJECT } from "../constants";
import type { OnboardingState, ProjectDraft, ShellMode } from "../types";

interface Step3ProjectsCommerceProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

const CT_REGIONS = [
  { label: "Google Cloud — North America (us-central1)", api: "https://api.us-central1.gcp.commercetools.com", auth: "https://auth.us-central1.gcp.commercetools.com" },
  { label: "AWS — North America (us-east-2)", api: "https://api.us-east-2.aws.commercetools.com", auth: "https://auth.us-east-2.aws.commercetools.com" },
  { label: "Google Cloud — Europe (europe-west1)", api: "https://api.europe-west1.gcp.commercetools.com", auth: "https://auth.europe-west1.gcp.commercetools.com" },
  { label: "AWS — Europe (eu-central-1)", api: "https://api.eu-central-1.aws.commercetools.com", auth: "https://auth.eu-central-1.aws.commercetools.com" },
  { label: "Custom Endpoints", api: "custom", auth: "custom" }
];

export function Step3ProjectsCommerce({ state, onChange }: Step3ProjectsCommerceProps) {
  const [testCredentials] = useMutation(ADMIN_TEST_PROJECT_CREDENTIALS);
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [testingId, setTestingId] = useState<string | null>(null);

  const projects = state.projects.length > 0 ? state.projects : [{ ...INITIAL_PROJECT }];
  const currentProject = projects[activeProjectIndex] || projects[0];

  const updateCurrentProject = (patch: Partial<ProjectDraft>) => {
    const updated = projects.map((p, idx) => (idx === activeProjectIndex ? { ...p, ...patch, testedOk: undefined, testMessage: undefined } : p));
    onChange({ projects: updated });
  };

  const handleAddProject = () => {
    const newProject: ProjectDraft = {
      ...INITIAL_PROJECT,
      id: `proj_${Date.now()}`,
      displayName: `Project ${projects.length + 1}`,
      projectKey: `${state.slug || "org"}-p${projects.length + 1}`
    };
    const updated = [...projects, newProject];
    onChange({ projects: updated });
    setActiveProjectIndex(updated.length - 1);
  };

  const handleRemoveProject = (indexToRemove: number) => {
    if (projects.length <= 1) return;
    const updated = projects.filter((_, idx) => idx !== indexToRemove);
    onChange({ projects: updated });
    setActiveProjectIndex(Math.max(0, indexToRemove - 1));
  };

  const handleTestConnection = async (proj: ProjectDraft) => {
    setTestingId(proj.id);
    const rawScope = proj.scopes?.trim();
    const cleanScope = rawScope && rawScope !== "manage_project:" ? rawScope : undefined;
    try {
      const { data } = await testCredentials({
        variables: {
          input: {
            platform: proj.platform,
            projectKey: proj.projectKey.trim(),
            ctAuthUrl: proj.ctAuthUrl,
            ctClientId: proj.ctClientId,
            ctClientSecret: proj.ctClientSecret,
            scopes: cleanScope,
            shopifyStoreDomain: proj.shopifyStoreDomain,
            shopifyAdminAccessToken: proj.shopifyAdminAccessToken,
            shopifyApiVersion: proj.shopifyApiVersion || "2024-01",
            bigcommerceStoreHash: proj.bigcommerceStoreHash,
            bigcommerceClientId: proj.bigcommerceClientId,
            bigcommerceAccessToken: proj.bigcommerceAccessToken
          }
        }
      });

      const res = data?.adminTestProjectCredentials;
      const updated = projects.map((p) =>
        p.id === proj.id
          ? {
            ...p,
            testedOk: Boolean(res?.ok),
            testMessage: res?.message || (res?.ok ? "Connection verified successfully!" : "Connection failed.")
          }
          : p
      );
      onChange({ projects: updated });
    } catch (e) {
      const updated = projects.map((p) =>
        p.id === proj.id
          ? {
            ...p,
            testedOk: false,
            testMessage: e instanceof Error ? e.message : "Failed to reach endpoint"
          }
          : p
      );
      onChange({ projects: updated });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <OnboardingStepShell
      stepNumber={3}
      totalSteps={6}
      title="Projects & Commerce Engine"
      description="Connect your commerce catalog and order systems. At least one project is required to satisfy tenant operations and provide project scope for users."
      required
      tip="Organizations can host multiple projects (e.g. US Retail B2C, EU Wholesale B2B). Each project binds to a specific commerce platform."
    >
      <div className="flex flex-col gap-6">
        {/* Project Tabs (for multiple projects) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-m-border pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {projects.map((proj, idx) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => setActiveProjectIndex(idx)}
                className={`flex items-center gap-2 rounded-m-md px-3.5 py-1.5 text-xs font-semibold transition-all ${idx === activeProjectIndex
                    ? "bg-m-primary text-white shadow-m-sm"
                    : "bg-m-surface text-m-text hover:bg-m-neutral-100 border border-m-border"
                  }`}
              >
                <span>{proj.displayName || `Project ${idx + 1}`}</span>
                {proj.testedOk && (
                  <Icon name="check-circle-2" size="xs" className="text-m-success" />
                )}
                {projects.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveProject(idx);
                    }}
                    className="ml-1 hover:text-m-error text-m-text-subtle"
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Icon name="plus" size="xs" />}
            onClick={handleAddProject}
          >
            Add Another Project
          </Button>
        </div>

        {/* Active Project Configuration Form */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-m-text">
                Project Display Name <span className="text-m-error">*</span>
              </label>
              <Input
                value={currentProject.displayName}
                onChange={(e) => updateCurrentProject({ displayName: e.target.value })}
                placeholder="e.g. US Storefront B2C"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-m-text">
                Project Key <span className="text-m-error">*</span>
              </label>
              <Input
                value={currentProject.projectKey}
                onChange={(e) =>
                  updateCurrentProject({
                    projectKey: e.target.value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "")
                  })
                }
                placeholder="e.g. acme-us-b2c"
                className="font-mono text-xs"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-m-text">Project Type</label>
              <Select
                value={currentProject.shellMode}
                onChange={(e) => updateCurrentProject({ shellMode: e.target.value as ShellMode })}
              >
                <option value="b2c">B2C Retail (Standard Consumer)</option>
                <option value="b2b">B2B Wholesale (Business Accounts & Quotes)</option>
              </Select>
            </div>
          </div>

          {/* Commerce Platform Selector Cards */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-m-text">
              Select Commerce Platform <span className="text-m-error">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COMMERCE_PLATFORMS.map((platform) => {
                const isSelected = currentProject.platform === platform.id;
                return (
                  <ProviderCard
                    key={platform.id}
                    id={platform.id}
                    title={platform.name}
                    badge={platform.badge}
                    badgeTone={platform.id === "commercetools" ? "success" : "neutral"}
                    description={platform.description}
                    selected={isSelected}
                    onClick={() => updateCurrentProject({ platform: platform.id })}
                    icon={platform.icon}
                  />
                );
              })}
            </div>
          </div>

          {/* Dynamic Platform Credentials Form */}
          <Card className="p-5 border border-m-border bg-m-surface shadow-m-card flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-m-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Icon name="key-round" size="xs" className="text-m-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-m-text">
                  {currentProject.platform === "commercetools"
                    ? "commercetools API Credentials"
                    : currentProject.platform === "shopify"
                      ? "Shopify Plus Store Credentials"
                      : "BigCommerce API Credentials"}
                </span>
              </div>
              <span className="text-[11px] text-m-text-muted">Encrypted at rest (AES-256-GCM)</span>
            </div>

            {/* commercetools fields */}
            {currentProject.platform === "commercetools" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-m-text">Commercetools Region Preset</label>
                  <Select
                    onChange={(e) => {
                      const sel = CT_REGIONS.find((r) => r.api === e.target.value);
                      if (sel && sel.api !== "custom") {
                        updateCurrentProject({ ctApiUrl: sel.api, ctAuthUrl: sel.auth });
                      }
                    }}
                    value={
                      CT_REGIONS.some((r) => r.api === currentProject.ctApiUrl)
                        ? currentProject.ctApiUrl
                        : "custom"
                    }
                  >
                    {CT_REGIONS.map((r) => (
                      <option key={r.api} value={r.api}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-m-text">API Endpoint URL *</label>
                    <Input
                      value={currentProject.ctApiUrl || ""}
                      onChange={(e) => updateCurrentProject({ ctApiUrl: e.target.value })}
                      placeholder="https://api.us-central1.gcp.commercetools.com"
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-m-text">Auth URL *</label>
                    <Input
                      value={currentProject.ctAuthUrl || ""}
                      onChange={(e) => updateCurrentProject({ ctAuthUrl: e.target.value })}
                      placeholder="https://auth.us-central1.gcp.commercetools.com"
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-m-text">Client ID *</label>
                    <Input
                      value={currentProject.ctClientId || ""}
                      onChange={(e) => updateCurrentProject({ ctClientId: e.target.value })}
                      placeholder="e.g. 5xX8j2-..."
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-m-text">Client Secret *</label>
                    <Input
                      type="password"
                      value={currentProject.ctClientSecret || ""}
                      onChange={(e) => updateCurrentProject({ ctClientSecret: e.target.value })}
                      placeholder="••••••••••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-m-text">
                    Scopes <span className="font-normal text-m-text-muted">(optional, defaults to manage_project:&lt;key&gt; or client assigned scopes)</span>
                  </label>
                  <Input
                    value={currentProject.scopes === "manage_project:" ? "" : (currentProject.scopes || "")}
                    onChange={(e) => updateCurrentProject({ scopes: e.target.value })}
                    placeholder={`manage_project:${currentProject.projectKey || "project-key"}`}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* Shopify fields */}
            {currentProject.platform === "shopify" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-m-text">Store Domain *</label>
                  <Input
                    value={currentProject.shopifyStoreDomain || ""}
                    onChange={(e) => updateCurrentProject({ shopifyStoreDomain: e.target.value })}
                    placeholder="my-store.myshopify.com"
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-m-text">Admin Access Token *</label>
                  <Input
                    type="password"
                    value={currentProject.shopifyAdminAccessToken || ""}
                    onChange={(e) => updateCurrentProject({ shopifyAdminAccessToken: e.target.value })}
                    placeholder="shpat_••••••••"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-m-text">API Version</label>
                  <Input
                    value={currentProject.shopifyApiVersion || "2024-01"}
                    onChange={(e) => updateCurrentProject({ shopifyApiVersion: e.target.value })}
                    placeholder="2024-01"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* BigCommerce fields */}
            {currentProject.platform === "bigcommerce" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-m-text">Store Hash *</label>
                  <Input
                    value={currentProject.bigcommerceStoreHash || ""}
                    onChange={(e) => updateCurrentProject({ bigcommerceStoreHash: e.target.value })}
                    placeholder="e.g. abc123def"
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-m-text">Client ID *</label>
                  <Input
                    value={currentProject.bigcommerceClientId || ""}
                    onChange={(e) => updateCurrentProject({ bigcommerceClientId: e.target.value })}
                    placeholder="e.g. 8x2ab..."
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-m-text">Access Token *</label>
                  <Input
                    type="password"
                    value={currentProject.bigcommerceAccessToken || ""}
                    onChange={(e) => updateCurrentProject({ bigcommerceAccessToken: e.target.value })}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            {/* Connection Test Actions & Result */}
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-m-border/60 pt-3">
              <div className="flex items-center gap-2">
                {currentProject.testedOk === true && (
                  <Badge variant="success" size="sm" dot>
                    Verified: {currentProject.testMessage}
                  </Badge>
                )}
                {currentProject.testedOk === false && (
                  <Badge variant="error" size="sm" dot>
                    Failed: {currentProject.testMessage}
                  </Badge>
                )}
                {currentProject.testedOk === undefined && (
                  <span className="text-[11px] text-m-text-subtle">
                    Click test to verify credentials with the provider before continuing.
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Icon name="refresh-cw" size="xs" className={testingId === currentProject.id ? "animate-spin" : ""} />}
                onClick={() => handleTestConnection(currentProject)}
                disabled={testingId === currentProject.id || !currentProject.projectKey}
              >
                {testingId === currentProject.id ? "Testing Connection..." : "Test Commerce Connection"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
