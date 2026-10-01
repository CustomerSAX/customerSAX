"use client";

import { use } from "react";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";

export default function SuperadminClientEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OnboardingWizard organizationId={id} mode="edit" />;
}
