"use client";

import { Suspense } from "react";
import { SuperadminOnboardingWizard } from "@/features/superadmin/SuperadminOnboardingWizard";

export default function SuperadminOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <SuperadminOnboardingWizard />
    </Suspense>
  );
}
