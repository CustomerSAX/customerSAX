import type { CrmAccount, CrmActivity, CrmActivityType, CrmAddress, CrmContact, CrmContactUpdate } from "../crm/types.js";
import { error } from "../crm/errors.js";
import type { CrmProvider } from "../providers/types.js";
import type { ZohoProjectClient } from "./project-client.js";

// Contract → Zoho CRM v8: CrmContact ↔ Contacts, CrmAccount ↔ Accounts,
// CrmActivity ↔ the contact's Calls / Tasks / Events (meetings) / Notes related lists.

type Lookup = { id?: string | null; name?: string | null; email?: string | null } | null | undefined;
type ZRecord = Record<string, unknown> & { id: string };
type ZList = { data?: ZRecord[]; info?: { more_records?: boolean; count?: number } };
type ZWrite = { data?: Array<{ code?: string; details?: { id?: string }; message?: string }> };

const PROVIDER = "zoho";
const CONTACT_FIELDS = [
  "First_Name", "Last_Name", "Full_Name", "Email", "Phone", "Mobile", "Title", "Account_Name",
  "Mailing_Street", "Mailing_City", "Mailing_State", "Mailing_Zip", "Mailing_Country", "Owner", "Created_Time", "Modified_Time"
].join(",");
const ACCOUNT_FIELDS = [
  "Account_Name", "Industry", "Account_Type", "Website", "Phone",
  "Billing_Street", "Billing_City", "Billing_State", "Billing_Code", "Billing_Country", "Owner", "Created_Time", "Modified_Time"
].join(",");

const ACTIVITY_LISTS: Array<{ module: string; type: CrmActivityType; fields: string; subject?: string; body: string; date: string; status?: string }> = [
  { module: "Calls", type: "CALL", fields: "Subject,Description,Call_Type,Call_Start_Time,Owner,Created_Time", subject: "Subject", body: "Description", date: "Call_Start_Time" },
  { module: "Tasks", type: "TASK", fields: "Subject,Description,Status,Due_Date,Owner,Created_Time", subject: "Subject", body: "Description", date: "Due_Date", status: "Status" },
  { module: "Events", type: "MEETING", fields: "Event_Title,Description,Start_DateTime,Owner,Created_Time", subject: "Event_Title", body: "Description", date: "Start_DateTime" },
  { module: "Notes", type: "OTHER", fields: "Note_Title,Note_Content,Owner,Created_Time", subject: "Note_Title", body: "Note_Content", date: "Created_Time" }
];
const CONTACT_FIELD_MAP: Array<[keyof CrmContactUpdate, string]> = [
  ["firstName", "First_Name"],
  ["lastName", "Last_Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["mobilePhone", "Mobile"],
  ["title", "Title"]
];

export const isZohoId = (value: string) => /^\d{1,25}$/.test(value);
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const lookup = (value: unknown) => (value && typeof value === "object" ? (value as Lookup) : null);

function address(r: ZRecord, prefix: "Mailing" | "Billing", zip: string): CrmAddress | null {
  const a = {
    street: str(r[`${prefix}_Street`]),
    city: str(r[`${prefix}_City`]),
    state: str(r[`${prefix}_State`]),
    postalCode: str(r[zip]),
    country: str(r[`${prefix}_Country`])
  };
  return Object.values(a).some((v) => v !== null) ? a : null;
}

/** Zoho dates carry the org's own offset; keep the calendar day as recorded. */
function dayOf(value: unknown) {
  const v = str(value);
  return v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

/** Zoho wants yyyy-MM-ddTHH:mm:ss±HH:mm. */
function zohoDateTime(day?: string | null) {
  return day ? `${day}T12:00:00+00:00` : `${new Date().toISOString().slice(0, 19)}+00:00`;
}

function hhmm(minutes: number) {
  const total = Math.max(1, Math.round(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function zohoProvider(client: ZohoProjectClient): CrmProvider {
  const link = (module: "Contacts" | "Accounts", id: string) => (client.recordBase ? `${client.recordBase}/tab/${module}/${id}` : null);

  function mapContact(r: ZRecord): CrmContact {
    const account = lookup(r.Account_Name);
    const fullName = str(r.Full_Name) ?? ([str(r.First_Name), str(r.Last_Name)].filter(Boolean).join(" ") || null);
    return {
      id: r.id,
      provider: PROVIDER,
      externalUrl: link("Contacts", r.id),
      firstName: str(r.First_Name),
      lastName: str(r.Last_Name),
      fullName,
      email: str(r.Email),
      phone: str(r.Phone),
      mobilePhone: str(r.Mobile),
      title: str(r.Title),
      accountId: account?.id ?? null,
      accountName: account?.name ?? null,
      mailingAddress: address(r, "Mailing", "Mailing_Zip"),
      ownerName: lookup(r.Owner)?.name ?? null,
      createdAt: str(r.Created_Time),
      lastModifiedAt: str(r.Modified_Time)
    };
  }

  function mapActivity(spec: (typeof ACTIVITY_LISTS)[number], r: ZRecord, contactId: string | null): CrmActivity {
    const status = spec.status ? str(r[spec.status]) : null;
    return {
      id: `${spec.module}:${r.id}`,
      provider: PROVIDER,
      type: spec.type,
      subject: spec.subject ? str(r[spec.subject]) : null,
      description: str(r[spec.body]),
      status,
      completed: spec.type === "TASK" ? status === "Completed" : null,
      activityDate: dayOf(r[spec.date]),
      contactId,
      accountId: null,
      ownerName: lookup(r.Owner)?.name ?? null,
      createdAt: str(r.Created_Time)
    };
  }

  async function getContact(id: string) {
    if (!isZohoId(id)) return null;
    const result = await client.api<ZList>(`Contacts/${id}?fields=${CONTACT_FIELDS}`);
    const record = result?.data?.[0];
    return record ? mapContact(record) : null;
  }

  function firstWrite(result: ZWrite | null, what: string) {
    const row = result?.data?.[0];
    if (!row || row.code !== "SUCCESS" || !row.details?.id)
      error(`Zoho did not save the ${what}${row?.code ? ` (${row.code})` : ""}`, "PROVIDER_ERROR");
    return row.details.id;
  }

  return {
    getContact,

    async findContactByEmail(email) {
      const value = email.trim();
      if (!value) return null;
      const result = await client.api<ZList>(`Contacts/search?email=${encodeURIComponent(value)}&fields=${CONTACT_FIELDS}&per_page=1`);
      const record = result?.data?.[0];
      return record ? mapContact(record) : null;
    },

    async searchContacts({ text, limit, offset }) {
      const term = text.trim();
      const pageLimit = Math.min(Math.max(Math.trunc(limit ?? 20) || 1, 1), 200);
      const pageOffset = Math.max(Math.trunc(offset ?? 0), 0);
      if (term.length < 2) return { results: [], total: 0, limit: pageLimit, offset: pageOffset };
      const page = Math.floor(pageOffset / pageLimit) + 1;
      const result = await client.api<ZList>(
        `Contacts/search?word=${encodeURIComponent(term)}&fields=${CONTACT_FIELDS}&page=${page}&per_page=${pageLimit}`
      );
      const results = (result?.data ?? []).map(mapContact);
      // Zoho reports only whether more pages exist; the total is known only on the last page.
      const total = result?.info?.more_records ? null : (page - 1) * pageLimit + results.length;
      return { results, total, limit: pageLimit, offset: pageOffset };
    },

    async getAccount(id) {
      if (!isZohoId(id)) return null;
      const result = await client.api<ZList>(`Accounts/${id}?fields=${ACCOUNT_FIELDS}`);
      const r = result?.data?.[0];
      if (!r) return null;
      const account: CrmAccount = {
        id: r.id,
        provider: PROVIDER,
        externalUrl: link("Accounts", r.id),
        // Account_Name is mandatory in Zoho; the fallback only guards a malformed response with the real ID.
        name: str(r.Account_Name) ?? r.id,
        industry: str(r.Industry),
        type: str(r.Account_Type),
        website: str(r.Website),
        phone: str(r.Phone),
        billingAddress: address(r, "Billing", "Billing_Code"),
        ownerName: lookup(r.Owner)?.name ?? null,
        createdAt: str(r.Created_Time),
        lastModifiedAt: str(r.Modified_Time)
      };
      return account;
    },

    async listAccountContacts(accountId, limit) {
      if (!isZohoId(accountId)) return [];
      const perPage = Math.min(Math.max(limit ?? 20, 1), 200);
      const result = await client.api<ZList>(`Accounts/${accountId}/Contacts?fields=${CONTACT_FIELDS}&per_page=${perPage}`);
      return (result?.data ?? []).map(mapContact);
    },

    async listContactActivities(contactId, limit) {
      if (!isZohoId(contactId)) return [];
      const pageLimit = Math.min(Math.max(Math.trunc(limit ?? 20) || 1, 1), 100);
      // Zoho's Calls / Tasks related lists hold only scheduled calls and open tasks; finished ones move to
      // Activities_Chronological_View_History. That list silently drops records when asked for a long, mixed
      // field list, so it is read with the fields every activity shares, then enriched by small per-type reads.
      const history = `Contacts/${contactId}/Activities_Chronological_View_History`;
      const [perType, closed, ...details] = await Promise.all([
        Promise.all(
          ACTIVITY_LISTS.map(async (spec) => {
            const result = await client.api<ZList>(`Contacts/${contactId}/${spec.module}?fields=${spec.fields}&per_page=${pageLimit}`);
            return (result?.data ?? []).map((r) => mapActivity(spec, r, contactId));
          })
        ),
        client.api<ZList>(`${history}?fields=Subject,Description,Owner,Created_Time&per_page=${pageLimit}`),
        client.api<ZList>(`${history}?fields=Subject,Status,Due_Date&per_page=${pageLimit}`),
        client.api<ZList>(`${history}?fields=Subject,Call_Start_Time&per_page=${pageLimit}`),
        client.api<ZList>(`${history}?fields=Event_Title,Start_DateTime&per_page=${pageLimit}`)
      ]);
      const extra = new Map<string, ZRecord>();
      for (const page of details)
        for (const r of page?.data ?? []) extra.set(r.id, { ...(extra.get(r.id) ?? {}), ...r } as ZRecord);
      const closedActivities = (closed?.data ?? []).flatMap((r) => {
        const spec = ACTIVITY_LISTS.find((s) => s.module === r.$module);
        return spec ? [mapActivity(spec, { ...(extra.get(r.id) ?? {}), ...r } as ZRecord, contactId)] : [];
      });
      const byId = new Map<string, CrmActivity>();
      for (const activity of [...perType.flat(), ...closedActivities]) if (!byId.has(activity.id)) byId.set(activity.id, activity);
      return [...byId.values()]
        .sort((a, b) => (b.activityDate ?? b.createdAt ?? "").localeCompare(a.activityDate ?? a.createdAt ?? ""))
        .slice(0, pageLimit);
    },

    async updateContact(id, patch) {
      if (!isZohoId(id)) return null;
      const fields: Record<string, string | null> = {};
      for (const [key, zField] of CONTACT_FIELD_MAP) if (patch[key] !== undefined) fields[zField] = patch[key] ?? null;
      if (!Object.keys(fields).length) error("No contact fields to update");
      if (!(await getContact(id))) return null;
      firstWrite(await client.api<ZWrite>(`Contacts/${id}`, "PUT", { data: [fields] }), "contact update");
      return getContact(id);
    },

    async logActivity(draft) {
      if (!isZohoId(draft.contactId)) error(`'${draft.contactId}' is not a valid Zoho contact ID`);
      const date = draft.activityDate?.trim();
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) error("activityDate must be YYYY-MM-DD");
      const who = { Who_Id: { id: draft.contactId } };

      if (draft.type === "CALL") {
        // Zoho requires a non-zero duration for a completed call; ask rather than invent one.
        if (!draft.durationMinutes || draft.durationMinutes <= 0)
          error("Zoho needs the call duration. Enter how many minutes the call lasted");
        const id = firstWrite(
          await client.api<ZWrite>("Calls", "POST", {
            data: [
              {
                ...who,
                Subject: draft.subject,
                Description: draft.description ?? null,
                Call_Type: "Outbound",
                Outbound_Call_Status: "Completed",
                Call_Start_Time: zohoDateTime(date),
                Call_Duration: hhmm(draft.durationMinutes)
              }
            ]
          }),
          "call"
        );
        const read = await client.api<ZList>(`Calls/${id}?fields=${ACTIVITY_LISTS[0].fields}`);
        if (!read?.data?.[0]) error(`Zoho created call ${id} but it could not be read back`, "PROVIDER_ERROR");
        return mapActivity(ACTIVITY_LISTS[0], read.data[0], draft.contactId);
      }

      if (draft.type === "TASK") {
        const status = draft.status?.trim() || (draft.completed === false ? "Not Started" : "Completed");
        const id = firstWrite(
          await client.api<ZWrite>("Tasks", "POST", {
            data: [{ ...who, Subject: draft.subject, Description: draft.description ?? null, Status: status, Due_Date: date ?? new Date().toISOString().slice(0, 10) }]
          }),
          "task"
        );
        const read = await client.api<ZList>(`Tasks/${id}?fields=${ACTIVITY_LISTS[1].fields}`);
        if (!read?.data?.[0]) error(`Zoho created task ${id} but it could not be read back`, "PROVIDER_ERROR");
        return mapActivity(ACTIVITY_LISTS[1], read.data[0], draft.contactId);
      }

      error(`Logging a ${draft.type} activity is not supported for Zoho yet — use CALL or TASK`);
    },

    async updateActivity(id, patch) {
      // Activity ids are "<Module>:<id>" (see mapActivity); only tasks have a status and due date.
      const match = /^(Calls|Tasks|Events|Notes):(\d{1,25})$/.exec(id);
      if (!match) return null;
      if (match[1] !== "Tasks") error("Only tasks can be marked done or rescheduled");
      const fields: Record<string, string> = {};
      if (typeof patch.completed === "boolean") fields.Status = patch.completed ? "Completed" : "Not Started";
      const date = patch.activityDate?.trim();
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error("activityDate must be YYYY-MM-DD");
        fields.Due_Date = date;
      }
      if (!Object.keys(fields).length) error("Nothing to update — pass completed or activityDate");
      const read = () => client.api<ZList>(`Tasks/${match[2]}?fields=${ACTIVITY_LISTS[1].fields}`);
      if (!(await read())?.data?.[0]) return null;
      firstWrite(await client.api<ZWrite>(`Tasks/${match[2]}`, "PUT", { data: [fields] }), "task update");
      const updated = (await read())?.data?.[0];
      return updated ? mapActivity(ACTIVITY_LISTS[1], updated, null) : null;
    }
  };
}
