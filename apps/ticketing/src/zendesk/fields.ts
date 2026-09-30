import { api as localApi } from "./client.js";
import type { ProviderField } from "../providers/types.js";

type Definition = {
  id: number;
  title: string;
  type: string;
  active: boolean;
  position?: number;
  custom_field_options?: Array<{ name: string; value: string }>;
};

// Read metadata on demand, so changes in Zendesk appear on the next detail refresh.
// Omitting pagination is supported by Zendesk and returns all field definitions.
export async function ticketFields(ticket: {
  status: string;
  custom_fields?: Array<{ id: number; value: unknown }>;
}, api = localApi): Promise<ProviderField[]> {
  const { ticket_fields } = await api<{ ticket_fields: Definition[] }>(
    "ticket_fields.json"
  );
  const values = new Map(ticket.custom_fields?.map((field) => [field.id, field.value]));
  const fields: ProviderField[] = [
    { id: "status", label: "Zendesk status", type: "text", value: ticket.status }
  ];
  const record = ticket as Record<string, unknown>;
  for (const [id, label] of [
    ["type", "Type"],
    ["tags", "Tags"],
    ["group_id", "Group ID"],
    ["organization_id", "Organization ID"],
    ["ticket_form_id", "Ticket form ID"]
  ]) {
    fields.push({ id, label, type: "text", value: display(record[id]) });
  }
  for (const field of ticket_fields
    .filter((field) => field.active && values.has(field.id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    const raw = values.get(field.id);
    const label = (value: unknown) =>
      field.custom_field_options?.find((option) => option.value === value)?.name ??
      display(value);
    fields.push({
      id: String(field.id),
      label: field.title,
      type: field.type,
      value: Array.isArray(raw) ? raw.map(label).join(", ") : label(raw)
    });
  }
  return fields;
}

function display(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(display).join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
