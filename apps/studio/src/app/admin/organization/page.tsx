import { AdminSettingsView } from "@/features/admin-settings/AdminSettingsView";

export const dynamic = "force-dynamic";

export default function AdminOrganizationPage() {
  return <AdminSettingsView section="organization" />;
}
