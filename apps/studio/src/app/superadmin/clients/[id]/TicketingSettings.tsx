"use client";

import { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Button, Input, Select } from "@csa/ui";
import { CARD_CLASS, LABEL_CLASS } from "./styles";
import type { ProjectRow } from "./types";

const READ = gql`
  query ProjectTicketing($clientId: ID!, $id: ID!) {
    adminProjectTicketing(clientId: $clientId, id: $id) {
      provider
      subdomain
      clientId
      secretSet
    }
  }
`;
const SAVE = gql`
  mutation SaveProjectTicketing(
    $clientId: ID!
    $id: ID!
    $input: AdminProjectTicketingInput!
  ) {
    adminSaveProjectTicketing(clientId: $clientId, id: $id, input: $input) {
      provider
      subdomain
      clientId
      secretSet
    }
  }
`;
const TEST = gql`
  mutation TestProjectTicketing(
    $clientId: ID!
    $id: ID!
    $input: AdminProjectTicketingInput!
  ) {
    adminTestProjectTicketing(clientId: $clientId, id: $id, input: $input) {
      success
      message
    }
  }
`;

export function TicketingSettings({
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
  const [provider, setProvider] = useState("internal");
  const [subdomain, setSubdomain] = useState("");
  const [oauthId, setOauthId] = useState("");
  const [secret, setSecret] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    const settings = data?.adminProjectTicketing;
    if (settings) {
      setProvider(settings.provider);
      setSubdomain(settings.subdomain);
      setOauthId(settings.clientId);
      setSecret("");
    }
  }, [data]);
  const busy = saving.loading || testing.loading;
  const input = {
    provider,
    subdomain,
    clientId: oauthId,
    clientSecret: secret || undefined
  };
  async function run(action: "save" | "test") {
    setNotice(null);
    try {
      if (action === "save") {
        await save({ variables: { clientId, id: project.id, input } });
        setSecret("");
        await refetch();
        onSaved();
        setNotice({
          ok: true,
          message: "Ticketing settings saved. New ticket requests use this provider."
        });
      } else {
        const response = await test({ variables: { clientId, id: project.id, input } });
        setNotice({
          ok: response.data.adminTestProjectTicketing.success,
          message: response.data.adminTestProjectTicketing.message
        });
      }
    } catch (e) {
      setNotice({
        ok: false,
        message: e instanceof Error ? e.message : "Unable to update ticketing settings"
      });
    }
  }
  return (
    <section
      className={`${CARD_CLASS} p-6`}
      aria-label={`Ticketing for ${project.displayName}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-m-text">Ticketing — {project.displayName}</h3>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
      {loading ? (
        <p>Loading ticketing settings…</p>
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
                { value: "internal", label: "Native ticketing" },
                { value: "zendesk", label: "Zendesk" }
              ]}
            />
          </label>
          {provider === "zendesk" && (
            <>
              <p className="text-sm text-m-text-muted">
                Use a confidential Zendesk OAuth client owned by an agent or admin, with
                read and tickets:write scopes. Agents use this connection automatically.
              </p>
              <label className={LABEL_CLASS}>
                Zendesk subdomain
                <Input
                  required
                  value={subdomain}
                  onChange={(e) => {
                    setSubdomain(e.target.value);
                    setNotice(null);
                  }}
                  placeholder="royalcyber-6021"
                  disabled={busy}
                />
              </label>
              <label className={LABEL_CLASS}>
                OAuth Identifier (client ID)
                <Input
                  required
                  value={oauthId}
                  onChange={(e) => {
                    setOauthId(e.target.value);
                    setNotice(null);
                  }}
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <label className={LABEL_CLASS}>
                Client secret
                {data?.adminProjectTicketing.secretSet
                  ? " — leave blank to keep saved secret"
                  : ""}
                <Input
                  type="password"
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value);
                    setNotice(null);
                  }}
                  autoComplete="new-password"
                  disabled={busy}
                />
              </label>
              <p className="text-sm text-m-text-muted">
                This project can access all tickets in the connected Zendesk account. Each
                account is reserved for one project, including while native ticketing is
                selected.
              </p>
            </>
          )}
          <p className="text-sm text-m-text-muted">
            Switching providers does not migrate tickets. Existing tickets remain in their
            original platform.
          </p>
          {notice && (
            <p role="status" className={notice.ok ? "text-m-success" : "text-m-error"}>
              {notice.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void run("test")}
              disabled={busy}
            >
              {testing.loading ? "Testing…" : "Test Connection"}
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {saving.loading ? "Saving…" : "Save Ticketing Settings"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
