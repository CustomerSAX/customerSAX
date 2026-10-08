"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import {
  Badge,
  Button,
  Card,
  Icon,
  LoadingSpinner
} from "@csa/ui";
import {
  ADMIN_CREATE_CLIENT,
  ADMIN_CREATE_PROJECT,
  ADMIN_CREATE_CLIENT_USER
} from "./api/queries";

export interface SuperadminOnboardingState {
  // Step 1: Org Details & Theme
  name: string;
  slug: string;
  contactEmail: string;
  uiTheme: "csa-custom" | "mantine" | "mui";

  // Step 2: Optional Initial Project
  createInitialProject: boolean;
  projectKey: string;
  displayName: string;
  platform: "commercetools" | "shopify" | "bigcommerce";
  shellMode: "b2c" | "b2b";

  // Step 3: First Organization Admin
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
}

const INITIAL_STATE: SuperadminOnboardingState = {
  name: "",
  slug: "",
  contactEmail: "",
  uiTheme: "csa-custom",

  createInitialProject: false,
  projectKey: "",
  displayName: "",
  platform: "commercetools",
  shellMode: "b2c",

  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPassword: ""
};

const STORAGE_KEY = "csa_superadmin_onboarding_draft";

export function SuperadminOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [state, setState] = useState<SuperadminOnboardingState>(INITIAL_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    clientId: string;
    orgName: string;
    adminEmail: string;
    projectKey?: string;
  } | null>(null);

  const [createClient] = useMutation(ADMIN_CREATE_CLIENT);
  const [createProject] = useMutation(ADMIN_CREATE_PROJECT);
  const [createClientUser] = useMutation(ADMIN_CREATE_CLIENT_USER);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) {
          setState((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save draft
  const updateState = (patch: Partial<SuperadminOnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    updateState({ name, slug: state.slug === "" || state.slug === state.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ? slug : state.slug });
  };

  const canProceedStep1 = Boolean(
    state.name.trim() &&
    state.slug.trim() &&
    state.contactEmail.trim().includes("@")
  );

  const canProceedStep2 =
    !state.createInitialProject ||
    Boolean(state.projectKey.trim() && state.displayName.trim());

  const canProceedStep3 = Boolean(
    state.adminEmail.trim().includes("@") &&
    state.adminPassword.length >= 8
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Create client organization
      const clientRes = await createClient({
        variables: {
          name: state.name.trim(),
          slug: state.slug.trim(),
          contactEmail: state.contactEmail.trim(),
          uiTheme: state.uiTheme
        }
      });
      const newClientId = clientRes.data?.adminCreateClient?.id;
      if (!newClientId) throw new Error("Failed to provision client organization tenant.");

      // 2. Optional: Create initial unconfigured project
      let createdProjectKey: string | undefined = undefined;
      if (state.createInitialProject && state.projectKey.trim()) {
        createdProjectKey = state.projectKey.trim();
        await createProject({
          variables: {
            clientId: newClientId,
            input: {
              platform: state.platform,
              projectKey: createdProjectKey,
              displayName: state.displayName.trim() || createdProjectKey,
              standaloneB2cEnabled: state.shellMode === "b2c",
              standaloneB2bEnabled: state.shellMode === "b2b"
            },
            createdBy: state.adminEmail.trim().toLowerCase()
          }
        });
      }

      // 3. Create initial Organization Admin
      await createClientUser({
        variables: {
          clientId: newClientId,
          grantedBy: "superadmin",
          input: {
            email: state.adminEmail.trim().toLowerCase(),
            password: state.adminPassword,
            firstName: state.adminFirstName.trim() || undefined,
            lastName: state.adminLastName.trim() || undefined,
            role: "admin",
            projects: createdProjectKey ? [{ projectKey: createdProjectKey, role: "admin" }] : []
          }
        }
      });

      // Clear draft
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("csa_onboarding_draft_v1");

      setSuccessResult({
        clientId: newClientId,
        orgName: state.name.trim(),
        adminEmail: state.adminEmail.trim().toLowerCase(),
        projectKey: createdProjectKey
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  if (successResult) {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4">
        <Card className="p-8 text-center border-m-success-200 bg-m-surface shadow-m-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-m-success-100 text-m-success">
            <Icon name="check-circle-2" size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-m-text">Organization Provisioned Successfully</h2>
          <p className="mt-2 text-sm text-m-text-muted">
            <strong className="text-m-text">{successResult.orgName}</strong> has been provisioned along with its initial administrator.
          </p>

          <div className="my-6 rounded-m-lg border border-m-border bg-m-neutral-50 p-4 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-m-text-muted">Organization ID:</span>
              <span className="font-mono font-semibold">{successResult.clientId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-m-text-muted">Organization Admin:</span>
              <span className="font-semibold text-m-primary">{successResult.adminEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-m-text-muted">Initial Project:</span>
              <span className="font-mono">
                {successResult.projectKey ? `${successResult.projectKey} (Setup Required)` : "None (Admin will create in Studio)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-m-text-muted">Credentials Ownership:</span>
              <span className="text-m-success font-medium">Customer Managed in Studio</span>
            </div>
          </div>

          <p className="text-xs text-m-text-muted mb-6">
            The administrator can now log in to customerSAX Studio to configure commerce credentials, connectors, and manage team access.
          </p>

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/superadmin/clients/${successResult.clientId}`)}
            >
              View Organization Details
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/superadmin/clients")}
            >
              All Client Organisations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const stepsMeta = [
    { num: 1, label: "Organization Details", desc: "Basic details & appearance" },
    { num: 2, label: "Optional Project", desc: "Initial commerce project" },
    { num: 3, label: "First Admin", desc: "Initial customer administrator" },
    { num: 4, label: "Review & Provision", desc: "Review metadata & create" }
  ];

  return (
    <div className="mx-auto max-w-4xl py-6 px-4">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-m-border pb-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-m-primary">Super Admin Onboarding</div>
          <h1 className="text-2xl font-extrabold text-m-text tracking-tight">Provision Client Organisation</h1>
          <p className="text-xs text-m-text-muted mt-0.5">
            Provision the customer organization and initial administrator. Platform secrets and connectors are configured by the customer admin.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/superadmin/clients")}
          leftIcon={<Icon name="arrow-left" size="xs" />}
        >
          Cancel
        </Button>
      </div>

      {/* Stepper Navigation */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stepsMeta.map((s) => (
          <div
            key={s.num}
            className={`flex flex-col rounded-m-lg border p-3 transition-colors ${
              currentStep === s.num
                ? "border-m-primary bg-m-primary-50 text-m-primary shadow-m-sm"
                : currentStep > s.num
                  ? "border-m-success-200 bg-m-success-50/50 text-m-text"
                  : "border-m-border bg-m-surface text-m-text-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep === s.num
                    ? "bg-m-primary text-white"
                    : currentStep > s.num
                      ? "bg-m-success text-white"
                      : "bg-m-neutral-200 text-m-text-muted"
                }`}
              >
                {currentStep > s.num ? "✓" : s.num}
              </span>
              <span className="text-xs font-bold truncate">{s.label}</span>
            </div>
            <span className="text-[10px] text-m-text-muted mt-1 truncate">{s.desc}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6 sm:p-8 border-m-border bg-m-surface shadow-m-card">
        {/* STEP 1: Organization Details & Theme */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-m-text">Organization Details</h2>
              <p className="text-xs text-m-text-muted">Enter the client organisation name, slug, and administrative contact email.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Organisation Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={state.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">URL Identifier (Slug) *</label>
                <input
                  type="text"
                  placeholder="acme-corporation"
                  value={state.slug}
                  onChange={(e) => updateState({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-m-text mb-1">Primary Contact Email *</label>
                <input
                  type="email"
                  placeholder="admin@acmewidgets.com"
                  value={state.contactEmail}
                  onChange={(e) => updateState({ contactEmail: e.target.value })}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-m-border">
              <label className="block text-xs font-bold text-m-text mb-1.5">Studio Theme</label>
              <p className="text-[11px] text-m-text-muted mb-3">Choose the visual style and design tokens for the organization.</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "csa-custom", name: "CSA Modern", desc: "Default enterprise theme" },
                  { key: "mantine", name: "Mantine Teal", desc: "Clean teal accents" },
                  { key: "mui", name: "MUI Warm", desc: "Deep warm orange styling" }
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => updateState({ uiTheme: t.key as any })}
                    className={`flex flex-col items-start rounded-m-lg border p-3 text-left transition-all ${
                      state.uiTheme === t.key
                        ? "border-m-primary bg-m-primary-50/50 shadow-m-sm"
                        : "border-m-border hover:border-m-border-strong bg-m-surface"
                    }`}
                  >
                    <span className="text-xs font-bold text-m-text">{t.name}</span>
                    <span className="text-[10px] text-m-text-muted mt-0.5">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-m-border">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep(2)}
                disabled={!canProceedStep1}
                rightIcon={<Icon name="arrow-right" size="xs" />}
              >
                Continue to Initial Project
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Optional Initial Project */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-m-text">Initial Project (Optional)</h2>
                <Badge variant="neutral" appearance="subtle" size="sm">Optional</Badge>
              </div>
              <p className="text-xs text-m-text-muted">
                You can optionally pre-provision an initial project identifier for this client. Platform credentials and secrets are entered by the Organization Admin.
              </p>
            </div>

            <div className="rounded-m-lg border border-m-border bg-m-neutral-50/70 p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.createInitialProject}
                  onChange={(e) => updateState({ createInitialProject: e.target.checked })}
                  className="h-4 w-4 rounded border-m-border text-m-primary focus:ring-m-primary"
                />
                <div>
                  <span className="text-xs font-bold text-m-text">Create an initial project now</span>
                  <p className="text-[11px] text-m-text-muted">
                    If skipped, the organization will be created with zero projects and the Organization Admin can create their first project from Studio upon login.
                  </p>
                </div>
              </label>
            </div>

            {state.createInitialProject && (
              <div className="space-y-4 rounded-m-lg border border-m-primary-200 bg-m-primary-50/20 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Project Key *</label>
                    <input
                      type="text"
                      placeholder="e.g. acme-us-store"
                      value={state.projectKey}
                      onChange={(e) => updateState({ projectKey: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Display Name *</label>
                    <input
                      type="text"
                      placeholder="Acme US Store"
                      value={state.displayName}
                      onChange={(e) => updateState({ displayName: e.target.value })}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Commerce Platform</label>
                    <select
                      value={state.platform}
                      onChange={(e) => updateState({ platform: e.target.value as any })}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                    >
                      <option value="commercetools">commercetools</option>
                      <option value="shopify">Shopify</option>
                      <option value="bigcommerce">BigCommerce</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Shell Mode</label>
                    <select
                      value={state.shellMode}
                      onChange={(e) => updateState({ shellMode: e.target.value as any })}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                    >
                      <option value="b2c">B2C Retail Shell</option>
                      <option value="b2b">B2B Wholesale Shell</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-m-primary bg-m-primary-50 rounded p-2.5 border border-m-primary-200">
                  <Icon name="shield-check" size="xs" />
                  <span>
                    <strong>Security Notice:</strong> No CommerceTools credentials or API secrets are required here. This project will be created in &quot;Setup Required&quot; status until configured by the Organization Admin.
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-m-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(1)}
                leftIcon={<Icon name="arrow-left" size="xs" />}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep(3)}
                disabled={!canProceedStep2}
                rightIcon={<Icon name="arrow-right" size="xs" />}
              >
                Continue to First Admin
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: First Organization Admin */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-m-text">First Organization Administrator</h2>
              <p className="text-xs text-m-text-muted">
                Create exactly one initial administrator account. This user will own the organization configuration in customerSAX Studio.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-m-text mb-1">First Name</label>
                <input
                  type="text"
                  placeholder="Sarah"
                  value={state.adminFirstName}
                  onChange={(e) => updateState({ adminFirstName: e.target.value })}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Last Name</label>
                <input
                  type="text"
                  placeholder="Connor"
                  value={state.adminLastName}
                  onChange={(e) => updateState({ adminLastName: e.target.value })}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Admin Email *</label>
                <input
                  type="email"
                  placeholder="sarah.connor@acmewidgets.com"
                  value={state.adminEmail}
                  onChange={(e) => updateState({ adminEmail: e.target.value })}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Password * (min. 8 characters)</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={state.adminPassword}
                  onChange={(e) => updateState({ adminPassword: e.target.value })}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>
            </div>

            <div className="rounded-m-lg border border-m-primary-200 bg-m-primary-50 p-3.5 text-xs text-m-primary flex items-start gap-2.5">
              <Icon name="sparkles" size="sm" className="shrink-0 mt-0.5" />
              <div>
                <strong>Organization-Level User:</strong> This user will have the <span className="font-mono font-bold">admin</span> role and will be able to log in even if no project exists yet. They can create additional projects, manage team members, and configure connectors.
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-m-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(2)}
                leftIcon={<Icon name="arrow-left" size="xs" />}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep(4)}
                disabled={!canProceedStep3}
                rightIcon={<Icon name="arrow-right" size="xs" />}
              >
                Continue to Review
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Provision */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-m-text">Review & Provision</h2>
              <p className="text-xs text-m-text-muted">Review the provisioning configuration before creating the organization tenant.</p>
            </div>

            {submitError && (
              <div className="rounded-m-lg border border-m-error-200 bg-m-error-50 p-4 text-xs text-m-error flex items-start gap-2.5">
                <Icon name="alert-triangle" size="sm" className="shrink-0 mt-0.5" />
                <div>
                  <strong>Provisioning Failed:</strong> {submitError}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase text-m-text-muted">1. Organization</div>
                <div className="font-bold text-sm text-m-text">{state.name}</div>
                <div className="text-xs font-mono text-m-text-muted">{state.slug}</div>
                <div className="text-xs text-m-text-muted">{state.contactEmail}</div>
                <div className="pt-1">
                  <Badge variant="neutral" appearance="subtle" size="sm">Theme: {state.uiTheme}</Badge>
                </div>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase text-m-text-muted">2. Initial Project</div>
                {state.createInitialProject ? (
                  <>
                    <div className="font-bold text-sm text-m-text">{state.displayName}</div>
                    <div className="text-xs font-mono text-m-text-muted">{state.projectKey}</div>
                    <div className="text-xs text-m-text-muted capitalize">Platform: {state.platform} ({state.shellMode.toUpperCase()})</div>
                    <div className="pt-1">
                      <Badge variant="warning" appearance="subtle" size="sm" dot>Setup Required</Badge>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-m-text-muted italic py-4">
                    None (Organization Admin will create the first project in Studio)
                  </div>
                )}
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase text-m-text-muted">3. Organization Admin</div>
                <div className="font-bold text-sm text-m-text">
                  {[state.adminFirstName, state.adminLastName].filter(Boolean).join(" ") || "Admin"}
                </div>
                <div className="text-xs font-medium text-m-primary">{state.adminEmail}</div>
                <div className="pt-1">
                  <Badge variant="success" appearance="subtle" size="sm">Role: Organization Admin</Badge>
                </div>
              </div>
            </div>

            <div className="rounded-m-lg border border-m-success-200 bg-m-success-50 p-3.5 text-xs text-m-success flex items-start gap-2.5">
              <Icon name="shield-check" size="sm" className="shrink-0 mt-0.5" />
              <div>
                <strong>Super Admin Security Boundary:</strong> No customer API keys, client secrets, passwords, or connector credentials are held or visible to Super Admin. Customer configuration ownership transfers fully to the Organization Admin upon provisioning.
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-m-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(3)}
                disabled={isSubmitting}
                leftIcon={<Icon name="arrow-left" size="xs" />}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                loading={isSubmitting}
                rightIcon={<Icon name="check" size="xs" />}
              >
                {isSubmitting ? "Provisioning..." : "Provision Organization"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
