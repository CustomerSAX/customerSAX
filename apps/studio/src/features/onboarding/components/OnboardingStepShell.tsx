"use client";

import type { ReactNode } from "react";
import { Badge, Icon } from "@csa/ui";

interface OnboardingStepShellProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  required?: boolean;
  tip?: string;
  children: ReactNode;
}

export function OnboardingStepShell({
  stepNumber,
  totalSteps,
  title,
  description,
  required = false,
  tip,
  children
}: OnboardingStepShellProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Step Header */}
      <div className="flex flex-col gap-2 border-b border-m-border/60 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-m-primary">
              Step {stepNumber} of {totalSteps}
            </span>
            <Badge
              variant={required ? "primary" : "neutral"}
              appearance="subtle"
              size="sm"
              className="text-[10px] font-semibold uppercase tracking-wider"
            >
              {required ? "Required" : "Optional"}
            </Badge>
          </div>
        </div>

        <h2 className="text-xl font-extrabold tracking-tight text-m-text sm:text-2xl">{title}</h2>
        <p className="max-w-3xl text-xs sm:text-sm text-m-text-muted leading-relaxed">{description}</p>

        {tip && (
          <div className="mt-2 flex items-start gap-2.5 rounded-m-lg border border-m-primary/20 bg-m-primary-50/60 p-3 text-xs text-m-primary">
            <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">{tip}</span>
          </div>
        )}
      </div>

      {/* Step Body */}
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
