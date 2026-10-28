"use client";

import { NativeConnectorsGrid } from "@/features/connectors/NativeConnectorsGrid";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import type { OnboardingState } from "../types";

export function Step4Connectors({ state }: Step4ConnectorsProps) {
  return (
    <OnboardingStepShell
      stepNumber={4}
      totalSteps={6}
      title="Native Connectors"
      description="Review the platform’s built-in capabilities. External connectors are discovered and configured through Connection Hub."
      tip="After creating the organization and project, open Admin Settings → Connection Hub to connect external services."
    >
      <NativeConnectorsGrid state={state} />
    </OnboardingStepShell>
  );
}

interface Step4ConnectorsProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}
