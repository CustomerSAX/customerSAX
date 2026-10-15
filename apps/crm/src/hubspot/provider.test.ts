import { beforeEach, expect, it, vi } from "vitest";
import { humanize, hubspotProvider, plainText } from "./provider.js";

const api = vi.fn();
const provider = (portalId: string | null = "12345") =>
  hubspotProvider({ accessToken: "pat-eu1-abc", portalId }, api as never);
const contact = {
  id: "101",
  properties: { firstname: "Ada", lastname: "Lovelace", email: "ada@example.com", hubspot_owner_id: "7", company: "Free text Co" },
  associations: { companies: { results: [{ id: "900", type: "contact_to_company" }] } }
};
beforeEach(() => {
  api.mockReset();
});

function route(handlers: Record<string, unknown>) {
  api.mockImplementation(async (...args: unknown[]) => {
    const path = args[0];
    if (typeof path !== "string")
      throw new Error(`request called without a path: ${JSON.stringify(args)} ${(new Error().stack ?? "").split(/\r?\n/).slice(2, 8).join(" | ")}`);
    const key = Object.keys(handlers).find((k) => path.startsWith(k));
    return key ? handlers[key] : null;
  });
}

it("finds a contact by lowercased email and resolves company, owner and an EU record link", async () => {
  route({
    "crm/v3/objects/contacts/search": { total: 1, results: [{ id: "101", properties: {} }] },
    "crm/v3/objects/contacts/101": contact,
    "crm/v3/objects/companies/900": { id: "900", properties: { name: "Analytical Engines" } },
    "crm/v3/owners/7": { firstName: "Grace", lastName: "Hopper" }
  });
  const result = await provider().findContactByEmail("ADA@Example.com");
  expect(api.mock.calls[0][2]).toMatchObject({
    filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: "ada@example.com" }] }]
  });
  expect(result).toMatchObject({
    id: "101",
    fullName: "Ada Lovelace",
    accountId: "900",
    accountName: "Analytical Engines",
    ownerName: "Grace Hopper",
    externalUrl: "https://app-eu1.hubspot.com/contacts/12345/record/0-1/101"
  });
});

it("leaves record links empty without a known portal, never guessing one", async () => {
  route({ "crm/v3/objects/contacts/101": { ...contact, associations: {} } });
  const result = await provider(null).getContact("101");
  expect(result?.externalUrl).toBeNull();
  expect(result?.accountName).toBe("Free text Co");
});

it("returns null for malformed IDs without calling HubSpot", async () => {
  expect(await provider().getContact("101; drop")).toBeNull();
  expect(await provider().getAccount("abc")).toBeNull();
  expect(await provider().listAccountContacts("x")).toEqual([]);
  expect(api).not.toHaveBeenCalled();
});

it("merges calls, tasks and notes newest-first and marks task completion from hs_task_status", async () => {
  route({
    "crm/v3/objects/contacts/101": {
      id: "101",
      properties: {},
      associations: { calls: { results: [{ id: "1" }] }, tasks: { results: [{ id: "2" }] }, notes: { results: [{ id: "3" }] } }
    },
    "crm/v3/objects/calls/batch/read": { results: [{ id: "1", properties: { hs_call_title: "Delay call", hs_call_status: "COMPLETED", hs_timestamp: "2026-10-01T10:00:00Z" } }] },
    "crm/v3/objects/tasks/batch/read": { results: [{ id: "2", properties: { hs_task_subject: "Refund follow-up", hs_task_status: "NOT_STARTED", hs_timestamp: "2026-10-15T09:00:00Z" } }] },
    "crm/v3/objects/notes/batch/read": { results: [{ id: "3", properties: { hs_note_body: "<p>VIP &amp; loyal</p>", hs_timestamp: "2026-09-20T09:00:00Z" } }] }
  });
  const activities = await provider().listContactActivities("101", 10);
  expect(activities.map((a) => [a.type, a.activityDate, a.completed])).toEqual([
    ["TASK", "2026-10-15", false],
    ["CALL", "2026-10-01", null],
    ["OTHER", "2026-09-20", null]
  ]);
  expect(activities[0]).toMatchObject({ id: "tasks:2", status: "Not Started", contactId: "101" });
  expect(activities[2].description).toBe("VIP & loyal");
});

it("logs a call associated to the contact and returns the persisted record", async () => {
  route({
    "crm/v3/objects/calls/555": { id: "555", properties: { hs_call_title: "Late delivery", hs_call_status: "COMPLETED", hs_timestamp: "2026-10-05T12:00:00.000Z" } }
  });
  api.mockImplementationOnce(async () => ({ id: "555", properties: {} }));
  const activity = await provider().logActivity({ contactId: "101", type: "CALL", subject: "Late delivery", activityDate: "2026-10-05" });
  expect(api.mock.calls[0]).toEqual([
    "crm/v3/objects/calls",
    "POST",
    {
      properties: expect.objectContaining({ hs_call_title: "Late delivery", hs_call_status: "COMPLETED", hs_timestamp: "2026-10-05T12:00:00.000Z" }),
      associations: [{ to: { id: "101" }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 194 }] }]
    }
  ]);
  expect(activity).toMatchObject({ id: "calls:555", type: "CALL", contactId: "101" });
});

it("refuses activity types it cannot log", async () => {
  await expect(provider().logActivity({ contactId: "101", type: "MEETING", subject: "x" })).rejects.toThrow("not supported");
  expect(api).not.toHaveBeenCalled();
});

it("does not patch a contact that does not exist", async () => {
  route({});
  expect(await provider().updateContact("101", { phone: "123" })).toBeNull();
  expect(api.mock.calls.every((c) => c[1] !== "PATCH")).toBe(true);
});

it("formats HubSpot enum values and strips HTML bodies", () => {
  expect(humanize("COMPUTER_SOFTWARE")).toBe("Computer Software");
  expect(humanize("Already readable")).toBe("Already readable");
  expect(plainText("<p>Hello<br>world</p>")).toBe("Hello\nworld");
  expect(plainText("")).toBeNull();
});

it("creates an open follow-up task when completed is false", async () => {
  route({ "crm/v3/objects/tasks/777": { id: "777", properties: { hs_task_subject: "Call back", hs_task_status: "NOT_STARTED" } } });
  api.mockImplementationOnce(async () => ({ id: "777", properties: {} }));
  const task = await provider().logActivity({ contactId: "101", type: "TASK", subject: "Call back", completed: false });
  expect(api.mock.calls[0][2]).toMatchObject({ properties: { hs_task_status: "NOT_STARTED" }, associations: [{ types: [{ associationTypeId: 204 }] }] });
  expect(task.completed).toBe(false);
});

it("updates only tasks: marks done and moves the due date", async () => {
  route({ "crm/v3/objects/tasks/321": { id: "321", properties: { hs_task_subject: "Refund", hs_task_status: "COMPLETED", hs_timestamp: "2026-10-20T12:00:00.000Z" } } });
  const updated = await provider().updateActivity("tasks:321", { completed: true, activityDate: "2026-10-20" });
  const patch = api.mock.calls.find((c) => c[1] === "PATCH");
  expect(patch).toEqual(["crm/v3/objects/tasks/321", "PATCH", { properties: { hs_task_status: "COMPLETED", hs_timestamp: "2026-10-20T12:00:00.000Z" } }]);
  expect(updated).toMatchObject({ id: "tasks:321", completed: true, activityDate: "2026-10-20" });
  await expect(provider().updateActivity("calls:5", { completed: true })).rejects.toThrow("Only tasks");
  expect(await provider().updateActivity("bogus", { completed: true })).toBeNull();
});
