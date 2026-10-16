import { api as localApi } from "./client.js";
import type { ProviderField } from "../providers/types.js";

type Definition = {
  id: number;
  title: string;
  type: string;
  active: boolean;
  agent_can_edit?: boolean;
  key?: string;
  position?: number;
  custom_field_options?: Array<{ name: string; value: string }>;
  system_field_options?: Array<{ name: string; value: string }>;
};

// Read metadata on demand, so changes in Zendesk appear on the next detail refresh.
// Omitting pagination is supported by Zendesk and returns all field definitions.
export async function ticketFields(
  ticket: {
    status: string;
    custom_fields?: Array<{ id: number; value: unknown }>;
  },
  api = localApi
): Promise<ProviderField[]> {
  const { ticket_fields } = await api<{ ticket_fields: Definition[] }>(
    "ticket_fields.json"
  );
  const values = new Map(ticket.custom_fields?.map((field) => [field.id, field.value]));
  const fields: ProviderField[] = [
    {
      id: "status",
      label: "Zendesk status",
      type: "select",
      value: ticket.status,
      rawValue: JSON.stringify(ticket.status),
      editable: ticket.status !== "closed",
      options: ["new", "open", "pending", "hold", "solved"].map((value) => ({
        label: value,
        value
      }))
    }
  ];
  const record = ticket as Record<string, unknown>;
  for (const [id, label] of [
    ["requester_id", "Requester (Zendesk user ID)"],
    ["assignee_id", "Assignee (Zendesk agent ID)"],
    ["follower_ids", "Followers (Zendesk agent IDs)"],
    ["priority", "Priority"],
    ["type", "Type"],
    ["tags", "Tags"],
    ["group_id", "Group ID"],
    ["organization_id", "Organization ID"],
    ["ticket_form_id", "Ticket form ID"]
  ]) {
    const choices =
      id === "type"
        ? ["question", "incident", "problem", "task"]
        : id === "priority"
          ? ["low", "normal", "high", "urgent"]
          : undefined;
    fields.push({
      id,
      label,
      type: choices ? "select" : "text",
      value: display(record[id]),
      rawValue: JSON.stringify(record[id] ?? null),
      editable: ticket.status !== "closed",
      options: choices?.map((value) => ({ label: value, value }))
    });
  }
  for (const field of fields) {
    const definition = ticket_fields.find(
      (item) => item.type === (field.id === "type" ? "tickettype" : field.id)
    );
    if (definition?.agent_can_edit === false) field.editable = false;
    if (definition?.system_field_options?.length)
      field.options = definition.system_field_options
        .filter((option) => option.value !== "closed")
        .map((option) => ({ label: option.name, value: option.value }));
  }
  for (const field of ticket_fields
    .filter(
      (field) =>
        field.active &&
        (values.has(field.id) ||
          [
            "text",
            "textarea",
            "integer",
            "decimal",
            "checkbox",
            "tagger",
            "multiselect",
            "date",
            "regexp"
          ].includes(field.type))
    )
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    const raw = values.get(field.id);
    const label = (value: unknown) =>
      field.custom_field_options?.find((option) => option.value === value)?.name ??
      display(value);
    fields.push({
      id: String(field.id),
      label: field.title,
      type: field.type,
      editable:
        ticket.status !== "closed" &&
        field.agent_can_edit === true &&
        !field.key?.startsWith("standard::") &&
        [
          "text",
          "textarea",
          "integer",
          "decimal",
          "checkbox",
          "tagger",
          "multiselect",
          "date",
          "regexp"
        ].includes(field.type),
      rawValue: JSON.stringify(raw ?? null),
      options: field.custom_field_options?.map((option) => ({
        label: option.name,
        value: option.value
      })),
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

/** Validate against freshly loaded metadata rather than trusting browser editability. */
export function fieldUpdate(
  fields: ProviderField[],
  changes: Array<{ id: string; value: string }>
) {
  if (!changes.length || changes.length > 100)
    throw new Error("Choose between 1 and 100 fields to update");
  const body: Record<string, unknown> = {};
  const custom: Array<{ id: number; value: unknown }> = [];
  const seen = new Set<string>();
  for (const change of changes) {
    const field = fields.find((field) => field.id === change.id);
    if (!field?.editable || seen.has(change.id))
      throw new Error(
        "This field is read-only or no longer available. Refresh the ticket."
      );
    seen.add(change.id);
    let value: unknown;
    try {
      value = JSON.parse(change.value);
    } catch {
      throw new Error(`Invalid value for ${field.label}`);
    }
    const invalid = () => {
      throw new Error(`Invalid value for ${field.label}`);
    };
    if (field.id.endsWith("_ids") || field.id === "tags") {
      if (
        !Array.isArray(value) ||
        value.some((item) =>
          field.id === "tags"
            ? typeof item !== "string" || !item.trim()
            : !Number.isSafeInteger(item) || item <= 0
        )
      )
        invalid();
    } else if (field.id.endsWith("_id")) {
      if (value !== null && (!Number.isSafeInteger(value) || Number(value) <= 0))
        invalid();
      if (field.id === "requester_id" && value === null) invalid();
    } else if (field.type === "checkbox") {
      if (typeof value !== "boolean") invalid();
    } else if (field.type === "multiselect") {
      if (
        !Array.isArray(value) ||
        value.some((item) => !field.options?.some((option) => option.value === item))
      )
        invalid();
    } else if (field.options) {
      if (value !== null && !field.options.some((option) => option.value === value))
        invalid();
      if (field.id === "status" && value === null) invalid();
    } else if (value !== null && typeof value !== "string" && typeof value !== "number")
      invalid();
    if (value !== null && field.type === "integer" && !/^-?\d+$/.test(String(value)))
      invalid();
    if (
      value !== null &&
      field.type === "decimal" &&
      !/^-?\d+(?:\.\d+)?$/.test(String(value))
    )
      invalid();
    if (
      value !== null &&
      field.type === "date" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(String(value))
    )
      invalid();
    if (field.id === "follower_ids") {
      const previous = JSON.parse(field.rawValue ?? "[]") as number[] | null;
      const next = value as number[];
      body.followers = [
        ...next.map((user_id) => ({ user_id, action: "put" })),
        ...(previous ?? [])
          .filter((user_id) => !next.includes(user_id))
          .map((user_id) => ({ user_id, action: "delete" }))
      ];
    } else if (/^\d+$/.test(field.id)) custom.push({ id: Number(field.id), value });
    else body[field.id] = value;
  }
  if (custom.length) body.custom_fields = custom;
  return body;
}
