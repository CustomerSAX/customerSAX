import { AdminSettingsView } from "@/features/admin-settings/AdminSettingsView";

export const dynamic = "force-dynamic";

export default function AdminConnectorsPage() {
  return <AdminSettingsView section="connectors" />;
}
