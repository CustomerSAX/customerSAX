export type AdminSettingsTab =
  | "organization"
  | "projects"
  | "connectors"
  | "connection-hub"
  | "knowledge-base"
  | "users"
  | "roles";

const ADMIN_TABS: Array<{
  id: AdminSettingsTab;
  label: string;
  icon: string;
  hidden?: boolean;
}> = [
  { id: "organization", label: "Organization", icon: "building-2" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "connection-hub", label: "Connection Hub", icon: "link" },
  { id: "connectors", label: "Native Connectors", icon: "layers", hidden: true },
  { id: "knowledge-base", label: "Knowledge Base", icon: "book-open" },
  { id: "users", label: "Users", icon: "users" },
  { id: "roles", label: "Roles", icon: "shield" }
];

export function getVisibleAdminTabs(isOrgAdmin: boolean) {
  return ADMIN_TABS.filter(
    (tab) => !tab.hidden && (isOrgAdmin || tab.id !== "organization")
  );
}
