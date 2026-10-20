"use client";

import { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Button, Input, Select } from "@csa/ui";
import { notify } from "@/features/notifications/notification-store";

const LABEL_CLASS = "mb-1 block text-xs font-semibold text-m-text";
const PROVIDER_NAME: Record<string, string> = { salesforce: "Salesforce", hubspot: "HubSpot", zoho: "Zoho CRM" };

/** The project fields the CRM form needs. */
export interface CrmSettingsProject {
  id: string;
  displayName: string;
}

const READ = gql`
  query ProjectCrm($clientId: ID!, $id: ID!) {
    adminProjectCrm(clientId: $clientId, id: $id) {
      provider
      salesforceInstanceUrl
      salesforceClientId
      salesforceSecretSet
      hubspotPortalId
      hubspotTokenSet
      zohoRegion
      zohoClientId
      zohoSecretSet
      zohoConnected
      zohoOrgId
    }
  }
`;
const SAVE = gql`
  mutation SaveProjectCrm($clientId: ID!, $id: ID!, $input: AdminProjectCrmInput!) {
    adminSaveProjectCrm(clientId: $clientId, id: $id, input: $input) {
      provider
      salesforceInstanceUrl
      salesforceClientId
      salesforceSecretSet
      hubspotPortalId
      hubspotTokenSet
      zohoRegion
      zohoClientId
      zohoSecretSet
      zohoConnected
      zohoOrgId
    }
  }
`;
// Zoho data centers (must match ZOHO_REGIONS in @csa/mongodb).
const ZOHO_REGION_OPTIONS = [
  { value: "us", label: "United States (zoho.com)" },
  { value: "eu", label: "Europe (zoho.eu)" },
  { value: "in", label: "India (zoho.in)" },
  { value: "au", label: "Australia (zoho.com.au)" },
  { value: "jp", label: "Japan (zoho.jp)" },
  { value: "cn", label: "China (zoho.com.cn)" },
  { value: "ca", label: "Canada (zohocloud.ca)" },
  { value: "sa", label: "Saudi Arabia (zoho.sa)" }
];
const ZOHO_SCOPES =
  "ZohoCRM.modules.contacts.ALL,ZohoCRM.modules.accounts.READ,ZohoCRM.modules.calls.ALL,ZohoCRM.modules.tasks.ALL,ZohoCRM.modules.events.READ,ZohoCRM.modules.notes.READ,ZohoCRM.org.READ,ZohoSearch.securesearch.READ";

const TEST = gql`
  mutation TestProjectCrm($clientId: ID!, $id: ID!, $input: AdminProjectCrmInput!) {
    adminTestProjectCrm(clientId: $clientId, id: $id, input: $input) {
      success
      message
    }
  }
`;

export function CrmSettings({
  clientId,
  project,
  onClose,
  onSaved,
  initialProvider
}: {
  clientId: string;
  project: CrmSettingsProject;
  onClose: () => void;
  onSaved: () => void;
  /** Provider picked from a connector card; the form opens on it (nothing changes until Save). */
  initialProvider?: string;
}) {
  const { data, loading, error, refetch } = useQuery(READ, {
    variables: { clientId, id: project.id },
    fetchPolicy: "network-only"
  });
  const [save, saving] = useMutation(SAVE);
  const [test, testing] = useMutation(TEST);
  const [provider, setProvider] = useState("none");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [hubspotToken, setHubspotToken] = useState("");
  const [zohoRegion, setZohoRegion] = useState("us");
  const [zohoClientId, setZohoClientId] = useState("");
  const [zohoSecret, setZohoSecret] = useState("");
  const [zohoGrantCode, setZohoGrantCode] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    const settings = data?.adminProjectCrm;
    if (settings) {
      setProvider(initialProvider || settings.provider);
      setInstanceUrl(settings.salesforceInstanceUrl);
      setConsumerKey(settings.salesforceClientId);
      setConsumerSecret("");
      setHubspotToken("");
      setZohoRegion(settings.zohoRegion || "us");
      setZohoClientId(settings.zohoClientId);
      setZohoSecret("");
      setZohoGrantCode("");
    }
  }, [data, initialProvider]);
  const busy = saving.loading || testing.loading;
  const savedProvider: string | undefined = data?.adminProjectCrm?.provider;
  const input = {
    provider,
    salesforceInstanceUrl: instanceUrl,
    salesforceClientId: consumerKey,
    salesforceClientSecret: consumerSecret || undefined,
    hubspotAccessToken: hubspotToken || undefined,
    zohoRegion,
    zohoClientId,
    zohoClientSecret: zohoSecret || undefined,
    zohoGrantCode: zohoGrantCode || undefined
  };
  async function run(action: "save" | "test") {
    setNotice(null);
    try {
      if (action === "save") {
        await save({ variables: { clientId, id: project.id, input } });
        setConsumerSecret("");
        setHubspotToken("");
        setZohoSecret("");
        setZohoGrantCode("");
        await refetch();
        onSaved();
        notify({
          variant: "success",
          title: provider === "none" ? "CRM disconnected" : `${PROVIDER_NAME[provider] ?? provider} connected`,
          description: project.displayName
        });
        setNotice({
          ok: true,
          message:
            provider === "none"
              ? "CRM settings saved. This project has no CRM connected."
              : "CRM settings saved. Agents and the AI assistant now use this CRM."
        });
      } else {
        const response = await test({ variables: { clientId, id: project.id, input } });
        setNotice({
          ok: response.data.adminTestProjectCrm.success,
          message: response.data.adminTestProjectCrm.message
        });
      }
    } catch (e) {
      setNotice({
        ok: false,
        message: e instanceof Error ? e.message : "Unable to update CRM settings"
      });
    }
  }
  return (
    <section className="p-6" aria-label={`CRM for ${project.displayName}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-m-text">CRM — {project.displayName}</h3>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
      {savedProvider && savedProvider !== "none" && savedProvider !== provider && (
        <p className="mb-4 rounded-m-md border border-m-warning/40 bg-m-warning/10 px-3 py-2 text-xs text-m-text">
          This project is currently connected to <strong>{PROVIDER_NAME[savedProvider] ?? savedProvider}</strong>. Saving will
          switch it to {provider === "none" ? "no CRM" : PROVIDER_NAME[provider] ?? provider} and release the current account.
        </p>
      )}
      {loading ? (
        <p>Loading CRM settings…</p>
      ) : error ? (
        <p role="alert">{error.message}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run("save");
          }}
        >
          <label className={LABEL_CLASS}>
            Provider
            <Select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setNotice(null);
              }}
              disabled={busy}
              options={[
                { value: "none", label: "No CRM" },
                { value: "salesforce", label: "Salesforce" },
                { value: "hubspot", label: "HubSpot" },
                { value: "zoho", label: "Zoho CRM" }
              ]}
            />
          </label>
          {provider === "salesforce" && (
            <>
              <p className="text-sm text-m-text-muted">
                Use a Salesforce External Client App (or Connected App) with the OAuth scope
                &quot;api&quot; and Client Credentials Flow enabled. Agents use this connection
                automatically; no Salesforce login is required.
              </p>
              <label className={LABEL_CLASS}>
                My Domain URL
                <Input
                  required
                  value={instanceUrl}
                  placeholder="https://royalcyber.my.salesforce.com"
                  disabled={busy}
                  onChange={(e) => {
                    setInstanceUrl(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>
              <label className={LABEL_CLASS}>
                Consumer key
                <Input
                  required
                  value={consumerKey}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(e) => {
                    setConsumerKey(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>
              <label className={LABEL_CLASS}>
                Consumer secret
                {data?.adminProjectCrm.salesforceSecretSet ? " — leave blank to keep saved secret" : ""}
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={consumerSecret}
                  disabled={busy}
                  onChange={(e) => {
                    setConsumerSecret(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>
              <p className="text-sm text-m-text-muted">
                Find these in Setup → External Client App Manager → your app → Settings → OAuth
                Settings. Record access follows the app&apos;s Run As user. Each Salesforce org can be
                connected to one project at a time.
              </p>
            </>
          )}
          {provider === "hubspot" && (
            <>
              <p className="text-sm text-m-text-muted">
                Use a HubSpot service key (Development → Keys → Service keys) or a legacy private app
                access token. Agents use this connection automatically; no HubSpot login is required.
              </p>
              <label className={LABEL_CLASS}>
                Service key / access token
                {data?.adminProjectCrm.hubspotTokenSet ? " — leave blank to keep saved key" : ""}
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={hubspotToken}
                  placeholder="pat-na1-…"
                  disabled={busy}
                  onChange={(e) => {
                    setHubspotToken(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>
              {data?.adminProjectCrm.hubspotPortalId ? (
                <p className="text-sm text-m-text-muted">Connected HubSpot account: {data.adminProjectCrm.hubspotPortalId}</p>
              ) : null}
              <p className="text-sm text-m-text-muted">
                Required scopes: crm.objects.contacts.read, crm.objects.contacts.write,
                crm.objects.companies.read, crm.objects.owners.read and sales-email-read (add oauth if
                offered, for record links). Each HubSpot account can be connected to one project at a time.
              </p>
            </>
          )}
          {provider === "zoho" && (
            <>
              <p className="text-sm text-m-text-muted">
                Use a Zoho Self Client (api-console.zoho.com, or the console for your region → Add Client → Self
                Client). Agents use this connection automatically; no Zoho login is required.
              </p>
              <label className={LABEL_CLASS}>
                Region
                <Select
                  value={zohoRegion}
                  onChange={(e) => {
                    setZohoRegion(e.target.value);
                    setNotice(null);
                  }}
                  disabled={busy}
                  options={ZOHO_REGION_OPTIONS}
                />
              </label>
              <label className={LABEL_CLASS}>
                Client ID
                <Input
                  required
                  value={zohoClientId}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(e) => {
                    setZohoClientId(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>
              <label className={LABEL_CLASS}>
                Client secret
                {data?.adminProjectCrm.zohoSecretSet ? " — leave blank to keep saved secret" : ""}
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={zohoSecret}
                  disabled={busy}
                  onChange={(e) => {
                    setZohoSecret(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>
              <label className={LABEL_CLASS}>
                Grant code
                {data?.adminProjectCrm.zohoConnected ? " — only needed to reconnect" : ""}
                <Input
                  type="password"
                  autoComplete="off"
                  value={zohoGrantCode}
                  placeholder="1000.…"
                  disabled={busy}
                  onChange={(e) => {
                    setZohoGrantCode(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>
              {data?.adminProjectCrm.zohoConnected ? (
                <p className="text-sm text-m-text-muted">
                  Connected{data.adminProjectCrm.zohoOrgId ? ` to Zoho org ${data.adminProjectCrm.zohoOrgId}` : ""}.
                </p>
              ) : null}
              <p className="text-sm text-m-text-muted">
                In the Self Client, open Generate Code, paste these scopes, choose 10 minutes and copy the code:{" "}
                <span className="break-all font-mono text-xs">{ZOHO_SCOPES}</span>. A grant code works once, for
                a few minutes: Save exchanges it and checks the connection, then Test Connection works any time.
                Each Zoho org can be connected to one project at a time.
              </p>
            </>
          )}
          <p className="text-sm text-m-text-muted">
            CSA reads and writes records in the connected CRM directly; switching providers does
            not migrate any CRM data. Choosing No CRM or another provider removes the saved
            credentials and frees the account for other projects.
          </p>
          {notice && (
            <p role="status" className={notice.ok ? "text-m-success" : "text-m-error"}>
              {notice.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => void run("test")} disabled={busy}>
              {testing.loading ? "Testing…" : "Test Connection"}
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {saving.loading ? "Saving…" : "Save CRM Settings"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
