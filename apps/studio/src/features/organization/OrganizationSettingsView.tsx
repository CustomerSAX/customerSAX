"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  Badge,
  Button,
  Card,
  Icon,
  Input,
  Select
} from "@csa/ui";
import { AppShell } from "@/components/shell/AppShell";
import { useCurrentUser } from "@/lib/use-current-user";
import { ADMIN_CLIENT_QUERY, ADMIN_UPDATE_CLIENT } from "@/features/superadmin/api/queries";

export function OrganizationSettingsView({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useCurrentUser();
  const clientId = user?.activeClientId || user?.organization?.id;
  const isOrgAdmin = user?.role === "admin" || user?.role === "superadmin";

  const { data, loading, error, refetch } = useQuery(ADMIN_CLIENT_QUERY, {
    variables: { id: clientId },
    skip: !clientId || !isOrgAdmin,
    fetchPolicy: "cache-and-network"
  });

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [uiTheme, setUiTheme] = useState("csa-custom");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [updateClient, { loading: saving }] = useMutation(ADMIN_UPDATE_CLIENT);

  useEffect(() => {
    if (data?.adminClient) {
      setName(data.adminClient.name || "");
      setContactEmail(data.adminClient.contactEmail || "");
      setUiTheme(data.adminClient.uiTheme || "csa-custom");
    }
  }, [data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Organization name is required");
      return;
    }

    try {
      await updateClient({
        variables: {
          id: clientId,
          name: name.trim(),
          contactEmail: contactEmail.trim() || undefined,
          uiTheme
        }
      });
      setSuccessMsg("Organization details updated successfully.");
      refetch();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update organization details");
    }
  };

  const client = data?.adminClient;
  const projects = data?.adminProjectsByClient || [];
  const users = data?.adminUsersByClient || [];

  const content = (
    <div className={embedded ? "space-y-6 max-w-4xl" : "space-y-6 p-6 max-w-4xl"}>
      {/* Header */}
      {embedded ? (
        <div>
          <h2 className="text-lg font-bold text-m-text">Organization Settings</h2>
          <p className="mt-0.5 text-xs text-m-text-muted">
            Manage your organization profile, contact email, branding, and design theme.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-m-primary">
            Organization / Settings
          </p>
          <h1 className="text-2xl font-bold text-m-text">Organization Settings</h1>
          <p className="mt-1 text-sm text-m-text-muted">
            Manage your organization profile, contact email, branding, and design theme.
          </p>
        </div>
      )}

        {/* Alerts */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
            <Icon name="check" size="sm" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            <Icon name="alert-triangle" size="sm" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-m-border bg-m-surface p-12 text-sm text-m-text-muted">
            <Icon name="loader" className="mr-2 animate-spin" size="sm" />
            Loading organization details...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-600 dark:text-red-400">
            Error loading organization: {error.message}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Stats Banner */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-m-border bg-m-surface p-4">
                <p className="text-xs font-medium text-m-text-muted">Projects</p>
                <p className="mt-1 text-2xl font-bold text-m-text">{projects.length}</p>
              </div>
              <div className="rounded-xl border border-m-border bg-m-surface p-4">
                <p className="text-xs font-medium text-m-text-muted">Users & Members</p>
                <p className="mt-1 text-2xl font-bold text-m-text">{users.length}</p>
              </div>
              <div className="rounded-xl border border-m-border bg-m-surface p-4">
                <p className="text-xs font-medium text-m-text-muted">Account Status</p>
                <div className="mt-1">
                  <Badge variant={client?.status === "active" ? "success" : "neutral"} size="sm">
                    {client?.status || "active"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Form Card */}
            <Card className="border border-m-border bg-m-surface p-6 shadow-m-card">
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                    Organization Name
                  </label>
                  <Input
                    className="mt-1.5"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Corp"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                    Contact Email
                  </label>
                  <Input
                    type="email"
                    className="mt-1.5"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="admin@acmecorp.com"
                  />
                  <p className="text-xs text-m-text-muted mt-1">
                    Primary administrative contact for system notifications and alerts.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                    Application Design Theme
                  </label>
                  <Select
                    className="mt-1.5"
                    value={uiTheme}
                    onChange={(e) => setUiTheme(e.target.value)}
                  >
                    <option value="csa-custom">CSA Modern (Meridian)</option>
                    <option value="mantine">Clean Corporate (Mantine Inspired)</option>
                    <option value="mui">Enterprise Standard (Material Inspired)</option>
                  </Select>
                  <p className="text-xs text-m-text-muted mt-1">
                    Applies the visual theme and token styling across Studio for all organization members.
                  </p>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-m-border">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    {saving && <Icon name="loader" className="animate-spin" size="xs" />}
                    <span>Save Settings</span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    );

  if (embedded) {
    return content;
  }

  return <AppShell>{content}</AppShell>;
}
