"use client";

import { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader } from "@csa/ui";

const SLA_FIELDS = "slaTargets { priority firstResponseMinutes resolutionMinutes }";
const PROJECT_SLA = gql`
  query ConnectorTicketingSla($clientId: ID!, $id: ID!) {
    adminProjectTicketing(clientId: $clientId, id: $id) { ${SLA_FIELDS} }
  }
`;
const SAVE_SLA = gql`
  mutation ConnectorSaveTicketingSla($clientId: ID!, $id: ID!, $targets: [AdminTicketingSlaTargetInput!]!) {
    adminSaveProjectTicketingSla(clientId: $clientId, id: $id, targets: $targets) { ${SLA_FIELDS} }
  }
`;

type SlaTargetRow = { priority: string; firstResponseMinutes: number | null; resolutionMinutes: number | null };
type Draft = Record<string, { firstResponse: string; resolution: string }>;

// "normal" is the stored priority the studio labels Medium everywhere else.
const PRIORITIES = [
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "normal", label: "Medium" },
  { key: "low", label: "Low" }
];

const toHours = (minutes: number | null) => (minutes == null ? "" : String(Math.round((minutes / 60) * 100) / 100));

/** Blank = no target; otherwise hours (decimals allowed) converted to whole minutes. */
function toMinutes(value: string, label: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const hours = Number(text);
  const minutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || minutes < 1) throw new Error(`${label} must be a positive number of hours (minimum 1 minute).`);
  return minutes;
}

/** SLA targets for native tickets in one project; Zendesk/Freshdesk own their SLA rules. */
export function NativeSlaTargetsModal({
  isOpen,
  onClose,
  clientId,
  project
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  project: { id: string; displayName: string };
}) {
  const { data, loading, error } = useQuery(PROJECT_SLA, {
    variables: { clientId, id: project.id },
    skip: !isOpen,
    fetchPolicy: "network-only"
  });
  const [save, { loading: saving }] = useMutation(SAVE_SLA);
  const [draft, setDraft] = useState<Draft>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const rows: SlaTargetRow[] = data?.adminProjectTicketing?.slaTargets ?? [];
    setDraft(Object.fromEntries(rows.map((row) => [row.priority, { firstResponse: toHours(row.firstResponseMinutes), resolution: toHours(row.resolutionMinutes) }])));
  }, [data]);

  const setCell = (priority: string, field: "firstResponse" | "resolution", value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [priority]: { ...(current[priority] ?? { firstResponse: "", resolution: "" }), [field]: value } }));
  };

  const handleSave = async () => {
    setFormError(null);
    setSaved(false);
    try {
      const targets = PRIORITIES.map(({ key, label }) => ({
        priority: key,
        firstResponseMinutes: toMinutes(draft[key]?.firstResponse ?? "", `${label} first response`),
        resolutionMinutes: toMinutes(draft[key]?.resolution ?? "", `${label} resolution`)
      }));
      await save({ variables: { clientId, id: project.id, targets } });
      setSaved(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not save SLA targets. Please try again.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" aria-label="Native ticket SLA targets">
      <ModalHeader
        title={`SLA targets — ${project.displayName}`}
        subtitle="Hours of 24/7 time for each priority. Leave a cell blank for no target."
        onClose={onClose}
      />
      <ModalBody className="space-y-4">
        {loading ? (
          <p className="text-sm text-m-text-muted">Loading SLA targets…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-600">Could not load SLA targets: {error.message}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-m-text-muted">
                <th className="pb-2 font-semibold">Priority</th>
                <th className="pb-2 font-semibold">First response (hours)</th>
                <th className="pb-2 font-semibold">Resolution (hours)</th>
              </tr>
            </thead>
            <tbody>
              {PRIORITIES.map(({ key, label }) => (
                <tr key={key}>
                  <td className="py-1.5 pr-3 font-medium text-m-text">{label}</td>
                  <td className="py-1.5 pr-3">
                    <Input size="sm" type="number" min="0" step="0.25" inputMode="decimal" aria-label={`${label} first response hours`}
                      value={draft[key]?.firstResponse ?? ""} onChange={(e) => setCell(key, "firstResponse", e.target.value)} />
                  </td>
                  <td className="py-1.5">
                    <Input size="sm" type="number" min="0" step="0.25" inputMode="decimal" aria-label={`${label} resolution hours`}
                      value={draft[key]?.resolution ?? ""} onChange={(e) => setCell(key, "resolution", e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ul className="list-disc space-y-1 pl-5 text-xs text-m-text-muted">
          <li>Targets apply to tickets created after you save. Existing tickets keep the targets they started with.</li>
          <li>The first response clock stops at the first agent action: moving the ticket out of Open, assigning it to a person, adding a note, a customer email, or resolving it.</li>
          <li>Both clocks pause while a ticket is Pending, and time spent resolved before a reopen doesn't count.</li>
        </ul>
        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        {saved && <p role="status" className="text-sm text-emerald-600">SLA targets saved. New tickets will use them.</p>}
      </ModalBody>
      <ModalFooter className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        <Button size="sm" variant="primary" onClick={() => void handleSave()} disabled={saving || loading || !!error}>
          {saving ? "Saving…" : "Save targets"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
