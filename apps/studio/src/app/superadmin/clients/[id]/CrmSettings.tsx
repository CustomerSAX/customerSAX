"use client";

import { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Button, Input, Select } from "@csa/ui";
import { CARD_CLASS, LABEL_CLASS } from "./styles";
import type { ProjectRow } from "./types";

const READ = gql`
  query ProjectCrm($clientId: ID!, $id: ID!) {
    adminProjectCrm(clientId: $clientId, id: $id) {
      provider
      salesforceInstanceUrl
      salesforceClientId
      salesforceSecretSet
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
    }
  }
`;
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
  onSaved
}: {
  clientId: string;
  project: ProjectRow;
  onClose: () => void;
  onSaved: () => void;
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
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    const settings = data?.adminProjectCrm;
    if (settings) {
      setProvider(settings.provider);
      setInstanceUrl(settings.salesforceInstanceUrl);
      setConsumerKey(settings.salesforceClientId);
      setConsumerSecret("");
    }
  }, [data]);
  const busy = saving.loading || testing.loading;
  const input = {
    provider,
    salesforceInstanceUrl: instanceUrl,
    salesforceClientId: consumerKey,
    salesforceClientSecret: consumerSecret || undefined
  };
  async function run(action: "save" | "test") {
    setNotice(null);
    try {
      if (action === "save") {
        await save({ variables: { clientId, id: project.id, input } });
        setConsumerSecret("");
        await refetch();
        onSaved();
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
    <section className={`${CARD_CLASS} p-6`} aria-label={`CRM for ${project.displayName}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-m-text">CRM — {project.displayName}</h3>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
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
                { value: "salesforce", label: "Salesforce" }
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
                Settings. Record access follows the app&apos;s Run As user. Each Salesforce org is
                reserved for one project, including while No CRM is selected.
              </p>
            </>
          )}
          <p className="text-sm text-m-text-muted">
            CSA reads and writes records in the connected CRM directly; switching providers does
            not migrate any CRM data.
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
