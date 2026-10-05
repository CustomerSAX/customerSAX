import { AdminSettingsView } from "@/features/admin-settings/AdminSettingsView";

export const dynamic = "force-dynamic";

export default function AdminKnowledgeBasePage() {
  return <AdminSettingsView section="knowledge-base" />;
}
