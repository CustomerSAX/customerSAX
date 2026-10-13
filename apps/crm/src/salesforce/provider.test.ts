import { beforeEach, expect, it, vi } from "vitest";
import { salesforceProvider } from "./provider.js";
const api = vi.hoisted(() => vi.fn());
const provider = () => salesforceProvider({ api, instanceUrl: async () => "https://acme.my.salesforce.com" });
const contact = { Id: "003XXXXXXXXXXXXAAA", FirstName: "Ada", LastName: "Lovelace", Name: "Ada Lovelace", Email: "ada@example.com" };
beforeEach(() => vi.resetAllMocks());
it("looks up a contact by escaped email and maps it with a deep link", async () => {
  api.mockResolvedValueOnce({ records: [contact] });
  const result = await provider().findContactByEmail("o'brien@example.com");
  expect(decodeURIComponent(api.mock.calls[0][0])).toContain("Email = 'o\\'brien@example.com'");
  expect(result).toMatchObject({
    id: contact.Id,
    fullName: "Ada Lovelace",
    externalUrl: "https://acme.my.salesforce.com/lightning/r/Contact/003XXXXXXXXXXXXAAA/view"
  });
});
it("returns null for malformed IDs without calling Salesforce", async () => {
  expect(await provider().getContact("003' OR Id != '")).toBeNull();
  expect(await provider().getAccount("short")).toBeNull();
  expect(api).not.toHaveBeenCalled();
});
it("reports an unknown search total as null rather than guessing", async () => {
  api.mockResolvedValueOnce({ searchRecords: [contact] });
  const page = await provider().searchContacts({ text: "Ada", limit: 5 });
  expect(page).toMatchObject({ total: null, limit: 5, offset: 0 });
  expect(page.results).toHaveLength(1);
});
it("logs a call as a completed Task and returns the persisted record", async () => {
  api.mockResolvedValueOnce({ id: "00TXXXXXXXXXXXXAAA" }).mockResolvedValueOnce({
    records: [{ Id: "00TXXXXXXXXXXXXAAA", Subject: "Late delivery", TaskSubtype: "Call", Status: "Completed", WhoId: contact.Id }]
  });
  const activity = await provider().logActivity({ contactId: contact.Id, type: "CALL", subject: "Late delivery", activityDate: "2026-10-01" });
  expect(api.mock.calls[0]).toEqual([
    "sobjects/Task",
    "POST",
    expect.objectContaining({ WhoId: contact.Id, TaskSubtype: "Call", Status: "Completed", ActivityDate: "2026-10-01" })
  ]);
  expect(activity).toMatchObject({ id: "00TXXXXXXXXXXXXAAA", type: "CALL", status: "Completed" });
});
it("refuses activity types Salesforce Tasks cannot represent", async () => {
  await expect(provider().logActivity({ contactId: contact.Id, type: "MEETING", subject: "x" })).rejects.toThrow("not supported");
  expect(api).not.toHaveBeenCalled();
});
it("does not patch a contact that does not exist", async () => {
  api.mockResolvedValueOnce({ records: [] });
  expect(await provider().updateContact(contact.Id, { phone: "123" })).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
});
it("lists other contacts at an account and skips malformed account IDs", async () => {
  api.mockResolvedValueOnce({ records: [contact] });
  const contacts = await provider().listAccountContacts("001XXXXXXXXXXXXAAA", 5);
  expect(decodeURIComponent(api.mock.calls[0][0])).toContain("WHERE AccountId = '001XXXXXXXXXXXXAAA'");
  expect(contacts).toHaveLength(1);
  expect(await provider().listAccountContacts("bad id")).toEqual([]);
  expect(api).toHaveBeenCalledTimes(1);
});
it("creates an open follow-up task when completed is false", async () => {
  api.mockResolvedValueOnce({ id: "00TXXXXXXXXXXXXAAB" }).mockResolvedValueOnce({ records: [{ Id: "00TXXXXXXXXXXXXAAB", TaskSubtype: "Task", Status: "Not Started", IsClosed: false }] });
  const task = await provider().logActivity({ contactId: contact.Id, type: "TASK", subject: "Call back", completed: false });
  expect(api.mock.calls[0][2]).toMatchObject({ Status: "Not Started", TaskSubtype: "Task" });
  expect(task.completed).toBe(false);
});
it("marks a task done and reschedules it, returning the persisted task", async () => {
  const task = { Id: "00TXXXXXXXXXXXXAAC", Subject: "Refund", Status: "Not Started", IsClosed: false, ActivityDate: "2026-10-11" };
  api.mockResolvedValueOnce({ records: [task] }).mockResolvedValueOnce(null).mockResolvedValueOnce({ records: [{ ...task, Status: "Completed", IsClosed: true, ActivityDate: "2026-10-20" }] });
  const updated = await provider().updateActivity("00TXXXXXXXXXXXXAAC", { completed: true, activityDate: "2026-10-20" });
  expect(api.mock.calls[1]).toEqual(["sobjects/Task/00TXXXXXXXXXXXXAAC", "PATCH", { Status: "Completed", ActivityDate: "2026-10-20" }]);
  expect(updated).toMatchObject({ completed: true, activityDate: "2026-10-20" });
});
it("reports a missing task as not found and never patches", async () => {
  api.mockResolvedValueOnce({ records: [] });
  expect(await provider().updateActivity("00TXXXXXXXXXXXXAAD", { completed: true })).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
  await expect(provider().updateActivity("00TXXXXXXXXXXXXAAD", {})).rejects.toThrow("Nothing to update");
});
