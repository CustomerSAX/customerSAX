import { beforeEach, expect, it, vi } from "vitest";
import { zohoProvider } from "./provider.js";

const api = vi.fn();
const provider = (recordBase: string | null = "https://crm.zoho.in/crm/org123") => zohoProvider({ api: api as never, recordBase });
const contact = {
  id: "5000001",
  First_Name: "Mahesh",
  Last_Name: "R",
  Full_Name: "Mahesh R",
  Email: "mahesh@example.com",
  Account_Name: { id: "6000001", name: "Demo Co" },
  Owner: { id: "1", name: "Vaagisha Choudhary" },
  Mailing_City: "Pune"
};
beforeEach(() => {
  api.mockReset();
});
function route(handlers: Record<string, unknown>) {
  api.mockImplementation(async (...args: unknown[]) => {
    const path = String(args[0]);
    const key = Object.keys(handlers).find((k) => path.startsWith(k));
    return key ? handlers[key] : null;
  });
}

it("finds a contact by email with company, owner and a record link", async () => {
  route({ "Contacts/search": { data: [contact] } });
  const result = await provider().findContactByEmail("mahesh@example.com");
  expect(api.mock.calls[0][0]).toContain("Contacts/search?email=mahesh%40example.com");
  expect(result).toMatchObject({
    id: "5000001",
    fullName: "Mahesh R",
    accountId: "6000001",
    accountName: "Demo Co",
    ownerName: "Vaagisha Choudhary",
    mailingAddress: { city: "Pune", street: null },
    externalUrl: "https://crm.zoho.in/crm/org123/tab/Contacts/5000001"
  });
});

it("returns null when Zoho has no match (204) and leaves links empty without an org", async () => {
  route({});
  expect(await provider().findContactByEmail("nobody@example.com")).toBeNull();
  route({ "Contacts/5000001": { data: [contact] } });
  expect((await provider(null).getContact("5000001"))?.externalUrl).toBeNull();
});

it("rejects malformed IDs without calling Zoho", async () => {
  expect(await provider().getContact("1 or 1=1")).toBeNull();
  expect(await provider().getAccount("abc")).toBeNull();
  expect(await provider().listContactActivities("x")).toEqual([]);
  expect(api).not.toHaveBeenCalled();
});

it("merges calls, tasks, meetings and notes newest-first with task completion", async () => {
  route({
    "Contacts/5000001/Calls": { data: [{ id: "1", Subject: "Delay call", Call_Start_Time: "2026-10-01T10:00:00+05:30" }] },
    "Contacts/5000001/Tasks": { data: [{ id: "2", Subject: "Refund follow-up", Status: "Not Started", Due_Date: "2026-10-15" }] },
    "Contacts/5000001/Events": { data: [{ id: "3", Event_Title: "Quarterly review", Start_DateTime: "2026-09-28T09:00:00+05:30" }] },
    "Contacts/5000001/Notes": { data: [{ id: "4", Note_Title: "VIP", Note_Content: "Prefers phone", Created_Time: "2026-09-20T09:00:00+05:30" }] }
  });
  const activities = await provider().listContactActivities("5000001", 10);
  expect(activities.map((a) => [a.id, a.type, a.activityDate, a.completed])).toEqual([
    ["Tasks:2", "TASK", "2026-10-15", false],
    ["Calls:1", "CALL", "2026-10-01", null],
    ["Events:3", "MEETING", "2026-09-28", null],
    ["Notes:4", "OTHER", "2026-09-20", null]
  ]);
});

it("reports a search total only when Zoho says there are no more pages", async () => {
  route({ "Contacts/search": { data: [contact], info: { more_records: false } } });
  expect((await provider().searchContacts({ text: "Mahesh", limit: 10 })).total).toBe(1);
  route({ "Contacts/search": { data: [contact], info: { more_records: true } } });
  expect((await provider().searchContacts({ text: "Mahesh", limit: 10 })).total).toBeNull();
});

it("logs a call with the given duration in hh:mm and refuses to invent one", async () => {
  await expect(provider().logActivity({ contactId: "5000001", type: "CALL", subject: "x" })).rejects.toThrow("call duration");
  expect(api).not.toHaveBeenCalled();
  api
    .mockResolvedValueOnce({ data: [{ code: "SUCCESS", details: { id: "777" } }] })
    .mockResolvedValueOnce({ data: [{ id: "777", Subject: "Late delivery", Call_Start_Time: "2026-10-06T12:00:00+00:00" }] });
  const call = await provider().logActivity({ contactId: "5000001", type: "CALL", subject: "Late delivery", durationMinutes: 75, activityDate: "2026-10-06" });
  expect(api.mock.calls[0]).toEqual([
    "Calls",
    "POST",
    {
      data: [
        expect.objectContaining({
          Who_Id: { id: "5000001" },
          Call_Type: "Outbound",
          Outbound_Call_Status: "Completed",
          Call_Duration: "01:15",
          Call_Start_Time: "2026-10-06T12:00:00+00:00"
        })
      ]
    }
  ]);
  expect(call).toMatchObject({ id: "Calls:777", type: "CALL", contactId: "5000001" });
});

it("creates an open follow-up task and surfaces a failed write", async () => {
  api
    .mockResolvedValueOnce({ data: [{ code: "SUCCESS", details: { id: "888" } }] })
    .mockResolvedValueOnce({ data: [{ id: "888", Subject: "Call back", Status: "Not Started", Due_Date: "2026-10-11" }] });
  const task = await provider().logActivity({ contactId: "5000001", type: "TASK", subject: "Call back", completed: false, activityDate: "2026-10-11" });
  expect(api.mock.calls[0][2]).toMatchObject({ data: [{ Status: "Not Started", Due_Date: "2026-10-11" }] });
  expect(task.completed).toBe(false);
  api.mockResolvedValueOnce({ data: [{ code: "MANDATORY_NOT_FOUND" }] });
  await expect(provider().logActivity({ contactId: "5000001", type: "TASK", subject: "x" })).rejects.toThrow("MANDATORY_NOT_FOUND");
});

it("refuses activity types Zoho cannot log", async () => {
  await expect(provider().logActivity({ contactId: "5000001", type: "EMAIL", subject: "x" })).rejects.toThrow("not supported");
  expect(api).not.toHaveBeenCalled();
});

it("includes finished calls and tasks from Zoho's activity history, enriched with their dates", async () => {
  const history = "Contacts/5000001/Activities_Chronological_View_History?fields=";
  api.mockImplementation(async (...args: unknown[]) => {
    const path = String(args[0]);
    if (path.startsWith("Contacts/5000001/Tasks")) return { data: [{ id: "2", Subject: "Open follow-up", Status: "Not Started", Due_Date: "2026-10-15" }] };
    if (path.startsWith(`${history}Subject,Description,Owner,Created_Time`))
      return { data: [{ id: "8", $module: "Calls", Subject: "Delay call" }, { id: "9", $module: "Tasks", Subject: "Sent label" }, { id: "2", $module: "Tasks", Subject: "Open follow-up" }] };
    if (path.startsWith(`${history}Subject,Status,Due_Date`)) return { data: [{ id: "9", $module: "Tasks", Status: "Completed", Due_Date: "2026-10-05" }] };
    if (path.startsWith(`${history}Subject,Call_Start_Time`)) return { data: [{ id: "8", $module: "Calls", Call_Start_Time: "2026-10-04T11:30:00+05:30" }] };
    return null;
  });
  const activities = await provider().listContactActivities("5000001", 10);
  expect(activities.map((a) => [a.id, a.type, a.activityDate, a.completed])).toEqual([
    ["Tasks:2", "TASK", "2026-10-15", false],
    ["Tasks:9", "TASK", "2026-10-05", true],
    ["Calls:8", "CALL", "2026-10-04", null]
  ]);
});

it("updates only tasks: marks done and moves the due date", async () => {
  api
    .mockResolvedValueOnce({ data: [{ id: "77", Subject: "Refund", Status: "Not Started", Due_Date: "2026-10-11" }] })
    .mockResolvedValueOnce({ data: [{ code: "SUCCESS", details: { id: "77" } }] })
    .mockResolvedValueOnce({ data: [{ id: "77", Subject: "Refund", Status: "Completed", Due_Date: "2026-10-20" }] });
  const updated = await provider().updateActivity("Tasks:77", { completed: true, activityDate: "2026-10-20" });
  expect(api.mock.calls[1]).toEqual(["Tasks/77", "PUT", { data: [{ Status: "Completed", Due_Date: "2026-10-20" }] }]);
  expect(updated).toMatchObject({ id: "Tasks:77", completed: true, activityDate: "2026-10-20" });
  await expect(provider().updateActivity("Calls:5", { completed: true })).rejects.toThrow("Only tasks");
});
