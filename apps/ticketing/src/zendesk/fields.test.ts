import { expect, it, vi } from "vitest";
import { api } from "./client.js";
import { ticketFields, fieldUpdate } from "./fields.js";

vi.mock("./client.js", () => ({ api: vi.fn() }));

it("renders active ticket fields using live labels and preserves empty, false, zero and multi-select values", async () => {
  vi.mocked(api).mockResolvedValue({
    ticket_fields: [
      {
        id: 1,
        title: "Environment",
        type: "tagger",
        active: true,
        custom_field_options: [{ name: "Production", value: "production" }]
      },
      { id: 2, title: "Enabled", type: "checkbox", active: true },
      { id: 3, title: "Count", type: "integer", active: true },
      { id: 4, title: "Summary", type: "text", active: true },
      {
        id: 5,
        title: "Platforms",
        type: "multiselect",
        active: true,
        custom_field_options: [{ name: "Web", value: "web" }]
      },
      { id: 6, title: "Inactive", type: "text", active: false },
      { id: 7, title: "Not on ticket", type: "text", active: true }
    ]
  });
  const result = await ticketFields({
    status: "open",
    custom_fields: [
      { id: 1, value: "production" },
      { id: 2, value: false },
      { id: 3, value: 0 },
      { id: 4, value: null },
      { id: 5, value: ["web", "unknown"] },
      { id: 6, value: "hidden" }
    ]
  });
  expect(
    result
      .filter((field) => /^\d+$/.test(field.id))
      .map((field) => [field.label, field.value])
  ).toEqual([
    ["Environment", "Production"],
    ["Enabled", "No"],
    ["Count", "0"],
    ["Summary", null],
    ["Platforms", "Web, unknown"],
    ["Not on ticket", null]
  ]);
});

it("uses agent editability, raw dropdown values and preserves read-only generated summaries", async () => {
  vi.mocked(api).mockResolvedValue({
    ticket_fields: [
      {
        id: 10,
        title: "Topic",
        type: "tagger",
        active: true,
        agent_can_edit: true,
        custom_field_options: [{ name: "Shipping", value: "topic_shipping" }]
      },
      { id: 11, title: "Summary", type: "textarea", active: true, agent_can_edit: false }
    ]
  });
  const fields = await ticketFields({
    status: "open",
    custom_fields: [
      { id: 10, value: "topic_shipping" },
      { id: 11, value: "AI summary" }
    ]
  });
  expect(fields.find((field) => field.id === "10")).toMatchObject({
    editable: true,
    rawValue: '"topic_shipping"',
    options: [{ label: "Shipping", value: "topic_shipping" }]
  });
  expect(fieldUpdate(fields, [{ id: "10", value: '"topic_shipping"' }])).toEqual({
    custom_fields: [{ id: 10, value: "topic_shipping" }]
  });
  expect(() => fieldUpdate(fields, [{ id: "10", value: '"Shipping"' }])).toThrow(
    "Invalid value"
  );
  expect(() => fieldUpdate(fields, [{ id: "11", value: '"overwrite"' }])).toThrow(
    "read-only"
  );
});

it("translates follower changes into Zendesk add and remove operations", () => {
  expect(
    fieldUpdate(
      [
        {
          id: "follower_ids",
          label: "Followers",
          type: "text",
          value: "1, 2",
          rawValue: "[1,2]",
          editable: true
        }
      ],
      [{ id: "follower_ids", value: "[2,3]" }]
    )
  ).toEqual({
    followers: [
      { user_id: 2, action: "put" },
      { user_id: 3, action: "put" },
      { user_id: 1, action: "delete" }
    ]
  });
});

it("disables every field on closed tickets and rejects forged updates", async () => {
  vi.mocked(api).mockResolvedValue({
    ticket_fields: [
      { id: 12, title: "Text", type: "text", active: true, agent_can_edit: true }
    ]
  });
  const fields = await ticketFields({
    status: "closed",
    custom_fields: [{ id: 12, value: "old" }]
  });
  expect(fields.every((field) => !field.editable)).toBe(true);
  expect(() => fieldUpdate(fields, [{ id: "status", value: '"open"' }])).toThrow(
    "read-only"
  );
  expect(() => fieldUpdate(fields, [{ id: "unknown", value: '"value"' }])).toThrow(
    "read-only"
  );
});
