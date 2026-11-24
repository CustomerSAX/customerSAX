"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Badge, Button, Input } from "@csa/ui";
import { X } from "lucide-react";
import type { HubCatalogConnector } from "@/lib/connection-hub-catalog";
import styles from "@/features/csa-assistant/components/assistant-integrations.module.css";

export type PreviewConnection = {
  account: string;
  resource: string;
  actions: string[];
};

export function PreviewConnectorDialog({
  connector,
  projectKey,
  connection,
  onClose,
  onSave,
  onDisconnect
}: {
  connector: HubCatalogConnector;
  projectKey: string;
  connection: PreviewConnection | null;
  onClose: () => void;
  onSave: (connection: PreviewConnection) => void;
  onDisconnect: () => void;
}) {
  const connected = connection !== null;
  const defaults = useMemo(
    () =>
      connector.actions.filter((action) => action.readOnly).map((action) => action.id),
    [connector.actions]
  );
  const [account, setAccount] = useState(connection?.account ?? "");
  const [resource, setResource] = useState(connection?.resource ?? "");
  const [credential, setCredential] = useState("");
  const [secret, setSecret] = useState("");
  const [actions, setActions] = useState(
    connection?.actions ??
      (defaults.length ? defaults : [connector.actions[0]?.id].filter(Boolean))
  );
  const authType = connector.authenticationType.toUpperCase();
  const usesOAuth = authType === "OAUTH2";
  const usesBasicAuth = authType === "BASIC_AUTH";
  const credentialsReady =
    connected || usesOAuth || (credential.trim() && (!usesBasicAuth || secret));
  const canSave = Boolean(account.trim() && actions.length > 0 && credentialsReady);

  function toggle(actionId: string) {
    setActions((current) =>
      current.includes(actionId)
        ? current.filter((item) => item !== actionId)
        : [...current, actionId]
    );
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.dialog}>
          <div className={styles.dialogHeader}>
            <div className="space-y-1">
              <Badge variant={connected ? "success" : "neutral"} dot size="sm">
                {connected ? "Active" : "Preview"}
              </Badge>
              <Dialog.Title className="text-lg font-semibold">
                {connected ? `Manage ${connector.name}` : `Connect ${connector.name}`}
              </Dialog.Title>
            </div>
            <Dialog.Close aria-label={`Close ${connector.name} connection`}>
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.muted}>
            {connected
              ? `Manage the ${connector.name} connection and enabled actions for ${projectKey}.`
              : `Configure ${connector.name} and choose the actions available to ${projectKey}.`}
          </Dialog.Description>

          {connected && (
            <dl className="grid gap-3 rounded-lg border border-m-border bg-m-surface-subtle p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                  Status
                </dt>
                <dd className="mt-1 font-medium text-m-text">Connected</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                  Authentication
                </dt>
                <dd className="mt-1 font-medium text-m-text">
                  {authenticationLabel(connector.authenticationType)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                  Account
                </dt>
                <dd className="mt-1 break-words font-medium text-m-text">{account}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                  Enabled actions
                </dt>
                <dd className="mt-1 font-medium text-m-text">{actions.length}</dd>
              </div>
            </dl>
          )}

          <form
            className={styles.connectionForm}
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSave) return;
              onSave({ account: account.trim(), resource: resource.trim(), actions });
            }}
          >
            <label htmlFor={`preview-${connector.id}-account`}>
              Account or workspace
            </label>
            <Input
              id={`preview-${connector.id}-account`}
              required
              maxLength={500}
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder={accountPlaceholder(connector.id)}
            />

            {!connected && !usesOAuth && (
              <>
                <label htmlFor={`preview-${connector.id}-credential`}>
                  {usesBasicAuth ? "API key ID" : authenticationLabel(authType)}
                </label>
                <Input
                  id={`preview-${connector.id}-credential`}
                  type={usesBasicAuth ? "text" : "password"}
                  required
                  autoComplete="off"
                  value={credential}
                  onChange={(event) => setCredential(event.target.value)}
                />
                {usesBasicAuth && (
                  <>
                    <label htmlFor={`preview-${connector.id}-secret`}>API secret</label>
                    <Input
                      id={`preview-${connector.id}-secret`}
                      type="password"
                      required
                      autoComplete="off"
                      value={secret}
                      onChange={(event) => setSecret(event.target.value)}
                    />
                  </>
                )}
              </>
            )}

            <label htmlFor={`preview-${connector.id}-resource`}>
              Resource scope{" "}
              <span className="font-normal text-m-text-muted">(optional)</span>
            </label>
            <Input
              id={`preview-${connector.id}-resource`}
              maxLength={500}
              value={resource}
              onChange={(event) => setResource(event.target.value)}
              placeholder="Repository, region, site, environment, or default"
            />

            <fieldset className="mt-2 space-y-2">
              <legend className="text-sm font-semibold text-m-text">
                Enabled actions
              </legend>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-m-border p-3">
                {connector.actions.map((action) => (
                  <label
                    key={action.id}
                    className="flex cursor-pointer items-start gap-2 text-sm font-normal text-m-text"
                  >
                    <input
                      type="checkbox"
                      checked={actions.includes(action.id)}
                      onChange={() => toggle(action.id)}
                      className="mt-0.5 accent-m-primary"
                    />
                    <span>
                      {action.name}
                      <span className="ml-2 text-xs text-m-text-muted">
                        {action.readOnly ? "Read only" : "Write"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {usesOAuth && !connected && (
              <p className={styles.muted}>
                You will continue through the provider&apos;s OAuth 2.0 authorization
                flow.
              </p>
            )}
            <p className={styles.muted}>
              Preview simulation only. No external account is contacted and credentials
              are not stored.
            </p>

            <div className={styles.dialogActions}>
              <Button type="submit" disabled={!canSave}>
                {connected
                  ? "Save changes"
                  : usesOAuth
                    ? `Continue with ${authenticationLabel(authType)}`
                    : `Connect ${connector.name}`}
              </Button>
              {connected && (
                <Button type="button" variant="danger" onClick={onDisconnect}>
                  Disconnect
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function authenticationLabel(type: string) {
  return (
    {
      OAUTH2: "OAuth 2.0",
      API_KEY: "API key",
      ACCESS_TOKEN: "Access token",
      BASIC_AUTH: "Basic auth"
    }[type.toUpperCase()] ?? type.replace(/_/g, " ")
  );
}

function accountPlaceholder(connectorId: string) {
  return (
    {
      commercetools: "Project key",
      shopify: "store-name.myshopify.com",
      bigcommerce: "Store hash",
      contentful: "Space ID",
      amplience: "Hub or repository",
      "adobe-experience-manager": "Author environment URL"
    }[connectorId] ?? "Tenant, workspace, portal, or account ID"
  );
}
