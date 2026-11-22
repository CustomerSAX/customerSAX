import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import { AdminSettingsView } from "@/features/admin-settings/AdminSettingsView";

export const dynamic = "force-dynamic";

export default async function AdminSettingsRootPage() {
  const user = await getCurrentUser();
  const isOrgAdmin = Boolean(user?.isOrgAdmin) || user?.role === "superadmin";
  if (!isOrgAdmin) {
    redirect("/admin-settings/projects");
  }

  return <AdminSettingsView section="organization" />;
}
