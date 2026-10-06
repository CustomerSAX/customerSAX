"use client";

import { use } from "react";
import { SuperadminClientDetailsView } from "@/features/superadmin/SuperadminClientDetailsView";

export default function SuperadminClientDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SuperadminClientDetailsView organizationId={id} />;
}
