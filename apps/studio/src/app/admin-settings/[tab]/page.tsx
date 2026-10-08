import { AdminSettingsView, type AdminSettingsTab } from "@/features/admin-settings/AdminSettingsView";

export const dynamic = "force-dynamic";

const TAB_MAP: Record<string, AdminSettingsTab> = {
  organization: "organization",
  projects: "projects",
  connectors: "connectors",
  users: "users",
  roles: "roles",
  email: "connectors",
  ai: "connectors",
  "ai-agent": "connectors"
};

export default async function AdminSettingsTabPage({
  params
}: {
  params: Promise<{ tab: string }>;
}) {
  const resolvedParams = await params;
  const tabKey = resolvedParams?.tab?.toLowerCase() ?? "";
  const tab = TAB_MAP[tabKey] ?? "organization";

  return <AdminSettingsView section={tab} />;
}
