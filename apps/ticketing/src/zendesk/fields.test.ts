import { expect, it, vi } from "vitest";
import { api } from "./client.js";
import { ticketFields } from "./fields.js";

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
    ["Platforms", "Web, unknown"]
  ]);
});
