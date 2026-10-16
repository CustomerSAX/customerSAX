"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { SectionCard, InfoList, InfoRow, CardEmpty, SecondaryButton } from "@csa/ui";
import { TICKET_PROVIDER_FIELDS, UPDATE_TICKET_PROVIDER_FIELDS } from "../api/queries";

type Field = {
  id: string;
  label: string;
  type: string;
  value: string | null;
  editable?: boolean;
  rawValue?: string;
  options?: Array<{ label: string; value: string }>;
};
const controlClass =
  "mt-1 w-full rounded-lg border border-m-border bg-m-surface px-3 py-2 text-sm text-m-text";

export function ProviderFields({
  id,
  provider,
  lastModifiedAt,
  onTicketChanged
}: {
  id: string;
  provider: string;
  lastModifiedAt?: string | null;
  onTicketChanged?: () => Promise<unknown>;
}) {
  const { data, loading, error, refetch } = useQuery<{ ticketProviderFields: Field[] }>(
    TICKET_PROVIDER_FIELDS,
    { variables: { id }, fetchPolicy: "network-only" }
  );
  const [save, { loading: saving }] = useMutation(UPDATE_TICKET_PROVIDER_FIELDS);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftStamp, setDraftStamp] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const fields = data?.ticketProviderFields ?? [];
  const changes = Object.entries(draft).filter(
    ([key, value]) => value !== fields.find((field) => field.id === key)?.rawValue
  );
  async function refresh() {
    setDraft({});
    setDraftStamp(null);
    setMessage("");
    setSaveError("");
    await Promise.all([refetch(), onTicketChanged?.()]);
  }
  async function submit() {
    if (!lastModifiedAt) return;
    setSaveError("");
    setMessage("");
    try {
      await save({
        variables: {
          id,
          expectedLastModifiedAt: draftStamp ?? lastModifiedAt,
          fields: changes.map(([id, raw]) => {
            let value: unknown = JSON.parse(raw);
            if (id === "tags" || id.endsWith("_ids")) {
              const items = String(value ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              if (
                id.endsWith("_ids") &&
                items.some(
                  (item) =>
                    !/^[1-9][0-9]*$/.test(item) || !Number.isSafeInteger(Number(item))
                )
              )
                throw new Error("Enter valid numeric IDs separated by commas.");
              value = id === "tags" ? items : items.map(Number);
            } else if (id.endsWith("_id")) {
              if (
                value &&
                (!/^[1-9][0-9]*$/.test(String(value)) ||
                  !Number.isSafeInteger(Number(value)))
              )
                throw new Error("Enter a valid numeric ID.");
              value = value ? Number(value) : null;
            }
            return { id, value: JSON.stringify(value) };
          })
        }
      });
      setDraft({});
      setDraftStamp(null);
      await Promise.all([refetch(), onTicketChanged?.()]);
      setMessage(`Changes saved to ${provider}.`);
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : "Could not save fields. Refresh and try again."
      );
    }
  }
  function edit(field: Field) {
    const raw = draft[field.id] ?? field.rawValue ?? "null";
    const value = JSON.parse(raw) as string | number | boolean | string[] | null;
    const set = (value: unknown) => {
      setMessage("");
      setDraftStamp(previous => previous ?? lastModifiedAt ?? null);
      setDraft((previous) => ({ ...previous, [field.id]: JSON.stringify(value) }));
    };
    if (field.type === "checkbox")
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => set(event.target.checked)}
          disabled={saving}
          className="ml-2"
        />
      );
    if (field.options?.length)
      return (
        <select
          className={controlClass}
          value={
            field.type === "multiselect"
              ? Array.isArray(value)
                ? value
                : []
              : String(value ?? "")
          }
          multiple={field.type === "multiselect"}
          disabled={saving}
          onChange={(event) =>
            set(
              field.type === "multiselect"
                ? Array.from(event.target.selectedOptions, (option) => option.value)
                : event.target.value || null
            )
          }
        >
          {field.type !== "multiselect" && <option value="">Select…</option>}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    if (field.type === "textarea")
      return (
        <textarea
          className={controlClass}
          value={text}
          disabled={saving}
          onChange={(event) => set(event.target.value || null)}
          rows={3}
        />
      );
    return (
      <input
        className={controlClass}
        type={field.type === "date" ? "date" : "text"}
        value={text}
        disabled={saving}
        onChange={(event) => {
          const text = event.target.value;
          set(text || null);
        }}
      />
    );
  }
  return (
    <SectionCard
      title={`${provider} Fields`}
      icon="tag"
      action={
        <SecondaryButton
          onClick={() => {
            void refresh().catch((cause) => setSaveError(String(cause)));
          }}
          disabled={loading || saving}
        >
          Refresh
        </SecondaryButton>
      }
    >
      {error ? (
        <CardEmpty
          icon="alert-triangle"
          title={`Unable to load ${provider} fields`}
          hint={error.message}
        />
      ) : loading && !data ? (
        <CardEmpty icon="loader" title={`Loading ${provider} fields…`} />
      ) : (
        <>
          <p className="mb-4 text-[12px] text-m-text-muted">
            {provider === "Zendesk"
              ? "Editable fields save directly to Zendesk. Zendesk-managed fields and closed tickets are read-only. Separate multiple tags or IDs with commas."
              : `Values from ${provider}. Edit these fields in ${provider}, then refresh.`}
          </p>
          <InfoList>
            {fields.map((field) =>
              field.editable && lastModifiedAt ? (
                <label key={field.id} className="block py-2 text-xs text-m-text-muted">
                  {field.label}
                  {edit(field)}
                </label>
              ) : (
                <InfoRow
                  key={field.id}
                  label={field.label}
                  value={field.value ?? undefined}
                />
              )
            )}
          </InfoList>
          {saveError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {saveError}
            </p>
          )}
          {message && (
            <p role="status" className="mt-3 text-sm text-emerald-700">
              {message}
            </p>
          )}
          {changes.length > 0 && (
            <div className="mt-4 flex gap-2">
              <SecondaryButton
                onClick={() => {
                  void submit();
                }}
                disabled={saving || loading}
              >
                {saving ? "Saving…" : `Save to ${provider}`}
              </SecondaryButton>
              <SecondaryButton onClick={() => { setDraft({}); setDraftStamp(null); }} disabled={saving}>
                Cancel
              </SecondaryButton>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
