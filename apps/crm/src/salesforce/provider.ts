import type { CrmActivity, CrmActivityDraft, CrmContactUpdate } from "../crm/types.js";
import type { CrmProvider } from "../providers/types.js";
import { error } from "./client.js";
import { mapAccount, mapContact, mapEvent, mapTask, type SfAccount, type SfContact, type SfEvent, type SfTask } from "./mappers.js";
import type { SalesforceProjectClient } from "./project-client.js";
import { ACCOUNT_FIELDS, CONTACT_FIELDS, EVENT_FIELDS, TASK_FIELDS, isSalesforceId, soqlString, soslTerm } from "./soql.js";

// Contract → Salesforce: CrmContact ↔ Contact, CrmAccount ↔ Account,
// CrmActivity ↔ Task (CALL/EMAIL/TASK via TaskSubtype) + Event (MEETING, read-only).

type QueryResult<T> = { records: T[] };
type SearchResult<T> = { searchRecords: T[] };

const TASK_SUBTYPE: Partial<Record<CrmActivityDraft["type"], string>> = { CALL: "Call", EMAIL: "Email", TASK: "Task" };
const CONTACT_FIELD_MAP: Array<[keyof CrmContactUpdate, string]> = [
  ["firstName", "FirstName"],
  ["lastName", "LastName"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["mobilePhone", "MobilePhone"],
  ["title", "Title"]
];

function clamp(value: number | undefined, fallback: number, max: number) {
  return Math.min(Math.max(Math.trunc(value ?? fallback) || 1, 1), max);
}

export function salesforceProvider(client: SalesforceProjectClient): CrmProvider {
  async function query<T>(soql: string) {
    return (await client.api<QueryResult<T>>(`query?q=${encodeURIComponent(soql)}`))?.records ?? [];
  }
  async function contactWhere(where: string) {
    const [records, instanceUrl] = await Promise.all([
      query<SfContact>(`SELECT ${CONTACT_FIELDS} FROM Contact WHERE ${where} ORDER BY LastModifiedDate DESC LIMIT 1`),
      client.instanceUrl()
    ]);
    return records[0] ? mapContact(records[0], instanceUrl) : null;
  }
  const getContact = (id: string) => (isSalesforceId(id) ? contactWhere(`Id = ${soqlString(id)}`) : Promise.resolve(null));

  return {
    getContact,

    findContactByEmail: (email) => {
      const value = email.trim();
      return value ? contactWhere(`Email = ${soqlString(value)}`) : Promise.resolve(null);
    },

    async searchContacts({ text, limit, offset }) {
      const term = text.trim();
      const pageLimit = clamp(limit, 20, 200);
      const pageOffset = Math.min(Math.max(Math.trunc(offset ?? 0), 0), 2000);
      // SOSL needs at least two characters; a shorter term cannot match.
      if (term.length < 2) return { results: [], total: 0, limit: pageLimit, offset: pageOffset };
      const sosl =
        `FIND {${soslTerm(term)}} IN ALL FIELDS RETURNING ` +
        `Contact(${CONTACT_FIELDS} ORDER BY LastModifiedDate DESC LIMIT ${pageLimit} OFFSET ${pageOffset})`;
      const [result, instanceUrl] = await Promise.all([
        client.api<SearchResult<SfContact>>(`search?q=${encodeURIComponent(sosl)}`),
        client.instanceUrl()
      ]);
      // SOSL reports no total match count, so total stays null rather than guessed.
      return {
        results: (result?.searchRecords ?? []).map((record) => mapContact(record, instanceUrl)),
        total: null,
        limit: pageLimit,
        offset: pageOffset
      };
    },

    async getAccount(id) {
      if (!isSalesforceId(id)) return null;
      const [records, instanceUrl] = await Promise.all([
        query<SfAccount>(`SELECT ${ACCOUNT_FIELDS} FROM Account WHERE Id = ${soqlString(id)} LIMIT 1`),
        client.instanceUrl()
      ]);
      return records[0] ? mapAccount(records[0], instanceUrl) : null;
    },

    async listAccountContacts(accountId, limit) {
      if (!isSalesforceId(accountId)) return [];
      const [records, instanceUrl] = await Promise.all([
        query<SfContact>(
          `SELECT ${CONTACT_FIELDS} FROM Contact WHERE AccountId = ${soqlString(accountId)} ORDER BY LastModifiedDate DESC LIMIT ${clamp(limit, 20, 100)}`
        ),
        client.instanceUrl()
      ]);
      return records.map((record) => mapContact(record, instanceUrl));
    },

    async listContactActivities(contactId, limit) {
      if (!isSalesforceId(contactId)) return [];
      const pageLimit = clamp(limit, 20, 100);
      const who = soqlString(contactId);
      const [tasks, events] = await Promise.all([
        query<SfTask>(`SELECT ${TASK_FIELDS} FROM Task WHERE WhoId = ${who} ORDER BY CreatedDate DESC LIMIT ${pageLimit}`),
        query<SfEvent>(`SELECT ${EVENT_FIELDS} FROM Event WHERE WhoId = ${who} ORDER BY CreatedDate DESC LIMIT ${pageLimit}`)
      ]);
      const activities: CrmActivity[] = [...tasks.map(mapTask), ...events.map(mapEvent)];
      return activities.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, pageLimit);
    },

    async updateContact(id, patch) {
      if (!isSalesforceId(id)) return null;
      const fields: Record<string, string | null> = {};
      for (const [key, sfField] of CONTACT_FIELD_MAP) if (patch[key] !== undefined) fields[sfField] = patch[key] ?? null;
      if (!Object.keys(fields).length) error("No contact fields to update");
      if (!(await getContact(id))) return null;
      await client.api(`sobjects/Contact/${id}`, "PATCH", fields);
      return getContact(id);
    },

    async logActivity(draft) {
      const subtype = TASK_SUBTYPE[draft.type];
      if (!subtype) error(`Logging a ${draft.type} activity is not supported for Salesforce yet — use CALL, EMAIL, or TASK`);
      if (!isSalesforceId(draft.contactId)) error(`'${draft.contactId}' is not a valid Salesforce contact ID`);
      const activityDate = draft.activityDate?.trim() || new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) error("activityDate must be YYYY-MM-DD");
      const created = await client.api<{ id?: string }>("sobjects/Task", "POST", {
        WhoId: draft.contactId,
        Subject: draft.subject,
        Description: draft.description ?? null,
        Status: draft.status?.trim() || (draft.completed === false ? "Not Started" : "Completed"),
        ActivityDate: activityDate,
        TaskSubtype: subtype,
        ...(draft.type === "CALL" && draft.durationMinutes && draft.durationMinutes > 0
          ? { CallDurationInSeconds: Math.round(draft.durationMinutes * 60) }
          : {})
      });
      if (!created?.id) error("Salesforce did not return an ID for the new activity", "PROVIDER_ERROR");
      const [task] = await query<SfTask>(`SELECT ${TASK_FIELDS} FROM Task WHERE Id = ${soqlString(created.id)} LIMIT 1`);
      if (!task) error(`Salesforce created activity ${created.id} but it could not be read back`, "PROVIDER_ERROR");
      return mapTask(task);
    },

    async updateActivity(id, patch) {
      if (!isSalesforceId(id)) return null;
      const fields: Record<string, string> = {};
      if (typeof patch.completed === "boolean") fields.Status = patch.completed ? "Completed" : "Not Started";
      const date = patch.activityDate?.trim();
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error("activityDate must be YYYY-MM-DD");
        fields.ActivityDate = date;
      }
      if (!Object.keys(fields).length) error("Nothing to update — pass completed or activityDate");
      const taskById = `SELECT ${TASK_FIELDS} FROM Task WHERE Id = ${soqlString(id)} LIMIT 1`;
      // Only tasks can be completed or rescheduled; an id that is not a Task is reported as not found.
      if (!(await query<SfTask>(taskById))[0]) return null;
      await client.api(`sobjects/Task/${id}`, "PATCH", fields);
      const [task] = await query<SfTask>(taskById);
      return task ? mapTask(task) : null;
    }
  };
}
