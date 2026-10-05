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
