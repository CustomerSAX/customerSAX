"use client";

import { SuperadminClientDetailsView } from "@/features/superadmin/SuperadminClientDetailsView";
import { use } from "react";

export default function SuperadminClientDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SuperadminClientDetailsView organizationId={id} />;
}
