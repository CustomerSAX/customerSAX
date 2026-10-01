"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";

function OnboardingWizardContent() {
  const searchParams = useSearchParams();
  const orgId =
    searchParams.get("id") ||
    searchParams.get("clientId") ||
    searchParams.get("organizationId") ||
    undefined;

  return <OnboardingWizard organizationId={orgId} mode={orgId ? "edit" : "create"} />;
}

export default function SuperadminOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingWizardContent />
    </Suspense>
  );
}
