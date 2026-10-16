"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@apollo/client";
import { Badge, Button, EmptyState, Icon, LoadingSpinner } from "@csa/ui";
import {
  ADMIN_CLIENT_QUERY,
  ADMIN_PROJECT_TICKETING_QUERY
} from "@/features/superadmin/api/queries";
import {
  INITIAL_ONBOARDING_STATE,
  ONBOARDING_DRAFT_STORAGE_KEY,
  STEPS
} from "./constants";
import type {
  OnboardingState,
  OnboardingWizardProps,
  StepId
} from "./types";
import { Step1Organization } from "./steps/Step1Organization";
import { Step2Appearance } from "./steps/Step2Appearance";
import { Step3ProjectsCommerce } from "./steps/Step3ProjectsCommerce";
import { Step4Connectors } from "./steps/Step4Connectors";
import { Step5TeamAccess } from "./steps/Step5TeamAccess";
import { Step6ReviewLaunch } from "./steps/Step6ReviewLaunch";
import { mapClientToOnboardingState } from "./mapping";

export function OnboardingWizard({
  organizationId,
  mode = organizationId ? "edit" : "create",
  initialStep = 1,
  onExit
}: OnboardingWizardProps = {}) {
  const router = useRouter();
  const isEdit = mode === "edit" || Boolean(organizationId);

  const [currentStep, setCurrentStep] = useState<StepId>(initialStep);
  const [state, setState] = useState<OnboardingState>(INITIAL_ONBOARDING_STATE);
  const [isLoaded, setIsLoaded] = useState(!isEdit);
  const [draftBannerVisible, setDraftBannerVisible] = useState(false);

  // Keep track of original backend IDs for edit mode
  const [originalProjectIds, setOriginalProjectIds] = useState<string[]>([]);
  const [originalSmtpProfileId, setOriginalSmtpProfileId] = useState<string | undefined>(undefined);

  // 1. EDIT MODE: Load existing organization data via GraphQL
  const {
    data: clientData,
    loading: clientLoading,
    error: clientError,
    refetch: refetchOrg
  } = useQuery(ADMIN_CLIENT_QUERY, {
    variables: { id: organizationId! },
    skip: !isEdit || !organizationId,
    fetchPolicy: "cache-first"
  });

  const primaryProjectId = clientData?.adminProjectsByClient?.[0]?.id;

  const { data: ticketingData } = useQuery(ADMIN_PROJECT_TICKETING_QUERY, {
    variables: { clientId: organizationId!, id: primaryProjectId! },
    skip: !isEdit || !organizationId || !primaryProjectId,
    fetchPolicy: "network-only"
  });

  // Populate state when editing existing organization
  useEffect(() => {
    if (!isEdit || !clientData?.adminClient) return;

    const mapped = mapClientToOnboardingState(clientData, ticketingData, organizationId);
    setOriginalProjectIds(mapped.originalProjectIds);
    setOriginalSmtpProfileId(mapped.originalSmtpProfileId);
    setState(mapped.state);
    setIsLoaded(true);
  }, [isEdit, clientData, ticketingData, organizationId]);

  // 2. CREATE MODE: Restore draft from localStorage on mount
  useEffect(() => {
    if (isEdit) return;

    try {
      const saved = localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.name) {
          setState((prev) => ({ ...prev, ...parsed }));
          setDraftBannerVisible(true);
        }
      }
    } catch {
      // ignore parse error
    } finally {
      setIsLoaded(true);
    }
  }, [isEdit]);

  // Auto-save draft on state change (in create mode only)
  const updateState = (patch: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (!isEdit) {
        try {
          localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage error
        }
      }
      return next;
    });
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    setState(INITIAL_ONBOARDING_STATE);
    setCurrentStep(1);
    setDraftBannerVisible(false);
  };

  const handleSaveAndExit = () => {
    if (!isEdit) {
      try {
        localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }
    if (onExit) {
      onExit();
    } else {
      router.push("/superadmin/clients");
    }
  };

  // Step Completion Logic for status icons
  const isStepCompleted = (stepId: StepId): boolean => {
    switch (stepId) {
      case 1:
        return Boolean(state.name.trim() && state.slug.trim() && state.contactEmail.trim());
      case 2:
        return Boolean(state.uiTheme);
      case 3:
        return state.projects.some(
          (p) =>
            p.projectKey.trim() &&
            (p.isExisting ||
              (p.platform === "commercetools"
                ? Boolean(p.ctClientId && (p.ctClientSecret || p.ctClientSecretMasked))
                : p.platform === "shopify"
                  ? Boolean(p.shopifyStoreDomain && p.shopifyAdminAccessToken)
                  : Boolean(p.bigcommerceStoreHash && p.bigcommerceAccessToken)))
        );
      case 4:
        return true;
      case 5:
        return state.teamMembers.length > 0;
      case 6:
        return false;
      default:
        return false;
    }
  };

  // Can user proceed from current step?
  const canProceed = (): boolean => {
    if (currentStep === 1) {
      return Boolean(state.name.trim() && state.slug.trim() && state.contactEmail.trim());
    }
    if (currentStep === 3) {
      return state.projects.some((p) => Boolean(p.projectKey.trim()));
    }
    return true; // Optional steps can always be continued
  };

  const handleNext = () => {
    if (currentStep < 6 && canProceed()) {
      setCurrentStep((prev) => (prev + 1) as StepId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleGoToStep = (stepId: StepId) => {
    setCurrentStep(stepId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentStepMeta = STEPS.find((s) => s.id === currentStep) || STEPS[0];
  const progressPercent = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);

  // Loading state for edit mode
  if (isEdit && clientLoading && !isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-m-surface-subtle gap-3">
        <LoadingSpinner />
        <span className="text-xs font-semibold text-m-text-muted">Loading organization configuration...</span>
      </div>
    );
  }

  // Error state for edit mode
  if (isEdit && (clientError || (!clientLoading && !clientData?.adminClient))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-m-surface-subtle p-6">
        <div className="max-w-md w-full bg-m-surface p-6 rounded-m-xl border border-m-border shadow-m-card text-center space-y-4">
          <EmptyState
            icon="alert-triangle"
            title="Organization Not Found"
            description={clientError?.message || "The requested client organization could not be found."}
          />
          <Button variant="primary" size="sm" onClick={() => router.push("/superadmin/clients")}>
            Return to Client Organizations
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-m-surface-subtle">
      {/* Wizard Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-m-border bg-m-surface px-6 py-3.5 shadow-m-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="arrow-left" size="xs" />}
            onClick={handleSaveAndExit}
            className="text-m-text-muted hover:text-m-text"
          >
            Exit to Clients
          </Button>
          <div className="h-4 w-px bg-m-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-m-text">
              {isEdit ? `Edit Organization · ${state.name || "Loading..."}` : "Organization Onboarding"}
            </span>
            <Badge variant="primary" size="sm" className="hidden sm:inline-flex">
              Step {currentStep} of {STEPS.length}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name={isEdit ? "check" : "save"} size="xs" />}
            onClick={handleSaveAndExit}
          >
            {isEdit ? "Exit to Clients" : "Save & Exit"}
          </Button>
        </div>
      </header>

      {/* Draft Resume Alert (Create Mode Only) */}
      {!isEdit && draftBannerVisible && (
        <div className="flex items-center justify-between bg-m-primary-50 px-6 py-2.5 border-b border-m-primary-200 text-xs text-m-primary">
          <div className="flex items-center gap-2">
            <Icon name="info" size="xs" />
            <span>
              Restored in-progress onboarding draft for <strong>{state.name || "Untitled Organization"}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-[11px] font-semibold underline hover:text-m-error"
            >
              Discard Draft & Start Fresh
            </button>
            <button
              type="button"
              onClick={() => setDraftBannerVisible(false)}
              className="text-m-primary/60 hover:text-m-primary"
            >
              <Icon name="x" size="xs" />
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar Line */}
      <div className="h-1 w-full bg-m-neutral-200">
        <div
          className="h-full bg-m-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Wizard Layout: Sidebar + Active Step Container */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
        {/* Left Navigation Stepper Sidebar */}
        <aside className="w-full shrink-0 border-b md:border-b-0 md:border-r border-m-border bg-m-surface p-4 md:w-72 lg:w-80">
          <div className="mb-4 hidden md:block">
            <div className="text-[10px] font-bold uppercase tracking-widest text-m-text-subtle">
              {isEdit ? "Organization Journey" : "Onboarding Journey"}
            </div>
            <div className="text-xs font-semibold text-m-text">
              {progressPercent}% Complete
            </div>
          </div>

          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            {STEPS.map((step) => {
              const isCurrent = step.id === currentStep;
              const isDone = isStepCompleted(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleGoToStep(step.id)}
                  className={`flex shrink-0 items-center justify-between rounded-m-lg px-3 py-2.5 text-left text-xs transition-all ${
                    isCurrent
                      ? "bg-m-primary-50 font-bold text-m-primary ring-1 ring-m-primary/30"
                      : "text-m-text-muted hover:bg-m-neutral-100 hover:text-m-text"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isDone
                          ? "bg-m-success text-white"
                          : isCurrent
                            ? "bg-m-primary text-white"
                            : "bg-m-neutral-200 text-m-text-muted"
                      }`}
                    >
                      {isDone ? <Icon name="check" size="xs" /> : step.id}
                    </div>
                    <span className="truncate">{step.navLabel}</span>
                  </div>

                  <span
                    className={`ml-2 hidden text-[10px] font-semibold uppercase tracking-wider lg:inline-block ${
                      step.required ? "text-m-primary" : "text-m-text-subtle"
                    }`}
                  >
                    {step.required ? "Req" : "Opt"}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Center / Right Content Panel */}
        <main className="flex flex-1 flex-col justify-between p-6 sm:p-10 max-w-4xl">
          <div className="flex-1 pb-10">
            {currentStep === 1 && (
              <Step1Organization state={state} onChange={updateState} onNext={handleNext} mode={mode} />
            )}
            {currentStep === 2 && (
              <Step2Appearance state={state} onChange={updateState} onNext={handleNext} />
            )}
            {currentStep === 3 && (
              <Step3ProjectsCommerce state={state} onChange={updateState} onNext={handleNext} mode={mode} />
            )}
            {currentStep === 4 && (
              <Step4Connectors state={state} onChange={updateState} onNext={handleNext} />
            )}
            {currentStep === 5 && (
              <Step5TeamAccess state={state} onChange={updateState} onNext={handleNext} mode={mode} />
            )}
            {currentStep === 6 && (
              <Step6ReviewLaunch
                state={state}
                onGoToStep={handleGoToStep}
                mode={mode}
                organizationId={organizationId}
                originalProjectIds={originalProjectIds}
                originalSmtpProfileId={originalSmtpProfileId}
                onSuccess={() => void refetchOrg()}
              />
            )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <footer className="sticky bottom-0 -mx-6 -mb-6 sm:-mx-10 sm:-mb-10 flex items-center justify-between border-t border-m-border bg-m-surface/95 backdrop-blur-sm px-6 py-4 shadow-m-modal">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Icon name="arrow-left" size="xs" />}
                  onClick={handleBack}
                >
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!currentStepMeta.required && currentStep < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleNext}
                  className="text-m-text-muted hover:text-m-text"
                >
                  Skip this Step
                </Button>
              )}

              {currentStep < 6 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  rightIcon={<Icon name="arrow-right" size="xs" />}
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {currentStep === 5 ? (isEdit ? "Continue to Review & Save" : "Continue to Review") : "Continue"}
                </Button>
              ) : null}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
