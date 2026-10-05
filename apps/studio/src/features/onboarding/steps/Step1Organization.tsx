"use client";

import { useState } from "react";
import { Input, Icon } from "@csa/ui";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import type { OnboardingState } from "../types";

interface Step1OrganizationProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function Step1Organization({ state, onChange }: Step1OrganizationProps) {
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(state.slug));

  const handleNameChange = (name: string) => {
    const patch: Partial<OnboardingState> = { name };
    if (!isSlugManuallyEdited) {
      patch.slug = slugify(name);
    }
    onChange(patch);
  };

  const handleSlugChange = (slugValue: string) => {
    setIsSlugManuallyEdited(true);
    onChange({ slug: slugify(slugValue) });
  };

  const isEmailValid = !state.contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contactEmail);

  return (
    <OnboardingStepShell
      stepNumber={1}
      totalSteps={6}
      title="Organization Foundation"
      description="Create your tenant organization account. This establishes the security boundary, branding, and multi-tenant container for your projects and users."
      required
      tip="The slug is used for dedicated tenant URLs and API attribution. It will be permanent once the organization is launched."
    >
      <div className="grid grid-cols-1 gap-6 max-w-2xl">
        {/* Organization Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="org-name" className="text-xs font-semibold text-m-text">
            Organization Name <span className="text-m-error">*</span>
          </label>
          <Input
            id="org-name"
            value={state.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Acme Global Corporation"
            autoFocus
            required
            className="h-11"
          />
          <span className="text-[11px] text-m-text-muted">
            The legal entity or brand display name visible across CSA dashboards.
          </span>
        </div>

        {/* Organization Slug */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="org-slug" className="text-xs font-semibold text-m-text">
              Organization Slug <span className="text-m-error">*</span>
            </label>
            <span className="text-[11px] font-mono text-m-text-subtle">
              tenant-id: {state.slug || "your-slug"}
            </span>
          </div>
          <div className="relative">
            <Input
              id="org-slug"
              value={state.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="acme-global"
              className="h-11 font-mono text-xs pl-8"
              required
            />
            <Icon
              name="globe"
              size="xs"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m-text-subtle"
            />
          </div>
          <span className="text-[11px] text-m-text-muted">
            Lowercase alphanumeric characters and hyphens only. Auto-generated from organization name.
          </span>
        </div>

        {/* Administrative Contact Email */}
        <div className="flex flex-col gap-2">
          <label htmlFor="org-email" className="text-xs font-semibold text-m-text">
            Administrative Contact Email <span className="text-m-error">*</span>
          </label>
          <div className="relative">
            <Input
              id="org-email"
              type="email"
              value={state.contactEmail}
              onChange={(e) => onChange({ contactEmail: e.target.value.trim() })}
              placeholder="admin@acmeglobal.com"
              required
              className={`h-11 pl-8 ${!isEmailValid ? "border-m-error focus:border-m-error focus:ring-m-error" : ""}`}
            />
            <Icon
              name="mail"
              size="xs"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m-text-subtle"
            />
          </div>
          {!isEmailValid ? (
            <span className="text-[11px] font-medium text-m-error">
              Please enter a valid administrative email address.
            </span>
          ) : (
            <span className="text-[11px] text-m-text-muted">
              Primary email used for critical notifications, alerts, and workspace recovery.
            </span>
          )}
        </div>
      </div>
    </OnboardingStepShell>
  );
}
