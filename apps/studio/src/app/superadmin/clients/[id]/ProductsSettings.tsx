"use client";

import { useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Button, Input, Select } from "@csa/ui";
import { CARD_CLASS, LABEL_CLASS } from "./styles";
import type { ProjectRow } from "./types";

const READ = gql`
  query ProjectProducts($clientId: ID!, $id: ID!) {
    adminProjectProducts(clientId: $clientId, id: $id) {
      configured
      provider
      appId
      indexName
      searchApiKeySet
    }
  }
`;
const SAVE = gql`
  mutation SaveProjectProducts(
    $clientId: ID!
    $id: ID!
    $input: AdminProjectProductsInput!
  ) {
    adminSaveProjectProducts(clientId: $clientId, id: $id, input: $input) {
      configured
      provider
      appId
      indexName
      searchApiKeySet
    }
  }
`;
const TEST = gql`
  mutation TestProjectProducts(
    $clientId: ID!
    $id: ID!
    $input: AdminProjectProductsInput!
  ) {
    adminTestProjectProducts(clientId: $clientId, id: $id, input: $input) {
      success
      message
    }
  }
`;

export function ProductsSettings({
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
  const settings = data?.adminProjectProducts;
  const [provider, setProvider] = useState<string>(settings?.provider ?? "commercetools");
  const [appId, setAppId] = useState<string>(settings?.appId ?? "");
  const [indexName, setIndexName] = useState<string>(settings?.indexName ?? "");
  const [searchApiKey, setSearchApiKey] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [loadedSettings, setLoadedSettings] = useState(settings);
  if (settings && settings !== loadedSettings) {
    setLoadedSettings(settings);
    setProvider(settings.provider);
    setAppId(settings.appId);
    setIndexName(settings.indexName);
    setSearchApiKey("");
  }
  const busy = saving.loading || testing.loading;
  async function run(action: "save" | "test") {
    setNotice(null);
    const variables = {
      clientId,
      id: project.id,
      input: {
        provider,
        appId,
        indexName,
        searchApiKey: searchApiKey || undefined
      }
    };
    try {
      if (action === "save") {
        await save({ variables });
        setSearchApiKey("");
        await refetch();
        onSaved();
        setNotice({
          ok: true,
          message: "Products settings saved. Reload Products to use this configuration."
        });
      } else {
        const response = await test({ variables });
        const result = response.data.adminTestProjectProducts;
        setNotice({ ok: result.success, message: result.message });
      }
    } catch (e) {
      setNotice({
        ok: false,
        message: e instanceof Error ? e.message : "Unable to update products settings"
      });
    }
  }
  return (
    <section
      className={`${CARD_CLASS} p-6`}
      aria-label={`Products for ${project.displayName}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-m-text">Products — {project.displayName}</h3>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
      {loading ? (
        <p>Loading products settings…</p>
      ) : error ? (
        <p role="alert">{error.message}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run("save");
          }}
          onChange={() => setNotice(null)}
        >
          {!data?.adminProjectProducts.configured && (
            <p className="text-sm text-m-text-muted">
              No project override is saved. Studio currently uses its environment
              configuration.
            </p>
          )}
          <label className={LABEL_CLASS}>
            Products provider
            <Select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={busy}
              options={[
                { value: "commercetools", label: "CommerceTools" },
                { value: "algolia", label: "Algolia" }
              ]}
            />
          </label>
          {provider === "algolia" ? (
            <>
              <label className={LABEL_CLASS}>
                Application ID
                <Input
                  required
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                />
              </label>
              <label className={LABEL_CLASS}>
                Index name
                <Input
                  required
                  value={indexName}
                  onChange={(e) => setIndexName(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                />
              </label>
              <label className={LABEL_CLASS}>
                Search-only API key
                {data?.adminProjectProducts.searchApiKeySet
                  ? " — leave blank to keep saved key"
                  : ""}
                <Input
                  type="password"
                  value={searchApiKey}
                  onChange={(e) => setSearchApiKey(e.target.value)}
                  disabled={busy}
                  autoComplete="new-password"
                />
              </label>
              <p className="text-sm text-m-text-muted">
                Use a search-only key restricted to this project&apos;s index.
                InstantSearch uses this key in the browser. Facets and filter values come
                from your Algolia index configuration.
              </p>
            </>
          ) : (
            <p className="text-sm text-m-text-muted">
              Use this project&apos;s existing CommerceTools connection for the product
              catalog.
            </p>
          )}
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
              {saving.loading ? "Saving…" : "Save Products Settings"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
