import {
  hubspotClient,
  hubspotUiDomain,
  type HubspotCredentials,
  type HubspotRequest
} from "@csa/mongodb";
import type {
  CrmAccount,
  CrmActivity,
  CrmActivityType,
  CrmAddress,
  CrmContact,
  CrmContactUpdate
} from "../crm/types.js";
import type { CrmProvider } from "../providers/types.js";
import { error } from "../crm/errors.js";

// Contract → HubSpot CRM v3: CrmContact ↔ contacts, CrmAccount ↔ companies,
// CrmActivity ↔ calls / emails / meetings / tasks / notes associated with the contact.

type Props = Record<string, string | null | undefined>;
type HsObject = { id: string; properties: Props; createdAt?: string; updatedAt?: string };
type HsAssociations = Record<
  string,
  { results: Array<{ id: string; type?: string }> } | undefined
>;
type HsObjectWithAssociations = HsObject & { associations?: HsAssociations };
type HsSearch = { total: number; results: HsObject[] };
type HsBatch = { results: HsObject[] };
type HsOwner = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

const PROVIDER = "hubspot";
const CONTACT_PROPS = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "jobtitle",
  "company",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "hubspot_owner_id",
  "createdate",
  "lastmodifieddate"
];
const COMPANY_PROPS = [
  "name",
  "industry",
  "type",
  "domain",
  "website",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "hubspot_owner_id",
  "createdate",
  "hs_lastmodifieddate"
];

/** Per engagement object: which properties carry subject/body/status, and its contract type. */
const ACTIVITY_OBJECTS: Array<{
  object: string;
  type: CrmActivityType;
  subject?: string;
  body: string;
  status?: string;
}> = [
  {
    object: "calls",
    type: "CALL",
    subject: "hs_call_title",
    body: "hs_call_body",
    status: "hs_call_status"
  },
  {
    object: "emails",
    type: "EMAIL",
    subject: "hs_email_subject",
    body: "hs_email_text",
    status: "hs_email_status"
  },
  {
    object: "meetings",
    type: "MEETING",
    subject: "hs_meeting_title",
    body: "hs_meeting_body",
    status: "hs_meeting_outcome"
  },
  {
    object: "tasks",
    type: "TASK",
    subject: "hs_task_subject",
    body: "hs_task_body",
    status: "hs_task_status"
  },
  { object: "notes", type: "OTHER", body: "hs_note_body" }
];
// HubSpot-defined association type IDs (engagement → contact).
const LOGGABLE: Partial<
  Record<CrmActivityType, { object: string; associationTypeId: number }>
> = {
  CALL: { object: "calls", associationTypeId: 194 },
  EMAIL: { object: "emails", associationTypeId: 198 },
  TASK: { object: "tasks", associationTypeId: 204 }
};
const CONTACT_FIELD_MAP: Array<[keyof CrmContactUpdate, string]> = [
  ["firstName", "firstname"],
  ["lastName", "lastname"],
  ["email", "email"],
  ["phone", "phone"],
  ["mobilePhone", "mobilephone"],
  ["title", "jobtitle"]
];
const PRIMARY_CONTACT_TO_COMPANY = "contact_to_company";

export const isHubspotId = (value: string) => /^\d{1,20}$/.test(value);
const clean = (value: string | null | undefined) =>
  value && value.trim() ? value : null;
const props = (list: string[]) => list.join(",");

/** HubSpot stores engagement bodies as HTML; show plain text. */
export function plainText(html: string | null | undefined) {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** HubSpot enum values (COMPUTER_SOFTWARE, NOT_STARTED) → readable labels. */
export function humanize(value: string | null | undefined) {
  const v = clean(value);
  if (!v || !/^[A-Z0-9_]+$/.test(v)) return v;
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function address(p: Props): CrmAddress | null {
  const a = {
    street: clean(p.address),
    city: clean(p.city),
    state: clean(p.state),
    postalCode: clean(p.zip),
    country: clean(p.country)
  };
  return Object.values(a).some((v) => v !== null) ? a : null;
}

function dayOf(timestamp: string | null | undefined) {
  const v = clean(timestamp);
  if (!v) return null;
  const date = /^\d+$/.test(v) ? new Date(Number(v)) : new Date(v);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function hubspotProvider(
  credentials: HubspotCredentials,
  request: HubspotRequest = hubspotClient(credentials)
): CrmProvider {
  return createHubspotProvider(
    request,
    credentials.portalId,
    hubspotUiDomain(credentials.accessToken)
  );
}

export function createHubspotProvider(
  request: HubspotRequest,
  portalId: string | null = null,
  uiDomain = "app.hubspot.com"
): CrmProvider {
  const link = (objectTypeId: "0-1" | "0-2", id: string) =>
    portalId
      ? `https://${uiDomain}/contacts/${portalId}/record/${objectTypeId}/${id}`
      : null;

  const owners = new Map<string, Promise<string | null>>();
  function ownerName(ownerId: string | null | undefined) {
    const id = clean(ownerId);
    if (!id || !isHubspotId(id)) return Promise.resolve(null);
    if (!owners.has(id)) {
      owners.set(
        id,
        request<HsOwner>(`crm/v3/owners/${id}`).then((o) =>
          o ? [o.firstName, o.lastName].filter(Boolean).join(" ") || clean(o.email) : null
        )
      );
    }
    return owners.get(id)!;
  }

  async function mapContact(
    o: HsObject,
    account?: { id: string; name: string | null } | null
  ): Promise<CrmContact> {
    const p = o.properties;
    const fullName =
      [clean(p.firstname), clean(p.lastname)].filter(Boolean).join(" ") || null;
    return {
      id: o.id,
      provider: PROVIDER,
      externalUrl: link("0-1", o.id),
      firstName: clean(p.firstname),
      lastName: clean(p.lastname),
      fullName,
      email: clean(p.email),
      phone: clean(p.phone),
      mobilePhone: clean(p.mobilephone),
      title: clean(p.jobtitle),
      accountId: account?.id ?? null,
      // Linked company's name when known; otherwise the contact's own "company" field.
      accountName: account ? account.name : clean(p.company),
      mailingAddress: address(p),
      ownerName: await ownerName(p.hubspot_owner_id),
      createdAt: clean(p.createdate) ?? o.createdAt ?? null,
      lastModifiedAt: clean(p.lastmodifieddate) ?? o.updatedAt ?? null
    };
  }

  async function companyName(id: string) {
    const company = await request<HsObject>(
      `crm/v3/objects/companies/${id}?properties=name`
    );
    return company ? clean(company.properties.name) : null;
  }

  async function getContact(id: string) {
    if (!isHubspotId(id)) return null;
    const o = await request<HsObjectWithAssociations>(
      `crm/v3/objects/contacts/${id}?properties=${props(CONTACT_PROPS)}&associations=companies`
    );
    if (!o) return null;
    const links = o.associations?.companies?.results ?? [];
    const primary = links.find((l) => l.type === PRIMARY_CONTACT_TO_COMPANY) ?? links[0];
    const account = primary
      ? { id: primary.id, name: await companyName(primary.id) }
      : null;
    return mapContact(o, account);
  }

  async function readEngagement(object: string, id: string) {
    const spec = ACTIVITY_OBJECTS.find((s) => s.object === object)!;
    const o = await request<HsObject>(
      `crm/v3/objects/${object}/${id}?properties=${props(engagementProps(spec))}`
    );
    return o ? mapActivity(spec, o) : null;
  }

  function engagementProps(spec: (typeof ACTIVITY_OBJECTS)[number]) {
    return [
      spec.subject,
      spec.body,
      spec.status,
      "hs_timestamp",
      "hubspot_owner_id",
      "hs_createdate"
    ].filter(Boolean) as string[];
  }

  async function mapActivity(
    spec: (typeof ACTIVITY_OBJECTS)[number],
    o: HsObject
  ): Promise<CrmActivity> {
    const p = o.properties;
    const status = spec.status ? clean(p[spec.status]) : null;
    return {
      id: `${spec.object}:${o.id}`,
      provider: PROVIDER,
      type: spec.type,
      subject: spec.subject ? clean(p[spec.subject]) : null,
      description: plainText(p[spec.body]),
      status: humanize(status),
      completed: spec.type === "TASK" ? status === "COMPLETED" : null,
      activityDate: dayOf(p.hs_timestamp),
      contactId: null,
      accountId: null,
      ownerName: await ownerName(p.hubspot_owner_id),
      createdAt: clean(p.hs_createdate) ?? o.createdAt ?? null
    };
  }

  return {
    getContact,

    async findContactByEmail(email) {
      const value = email.trim().toLowerCase();
      if (!value) return null;
      const found = await request<HsSearch>("crm/v3/objects/contacts/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value }] }],
        properties: ["email"],
        limit: 1
      });
      const id = found?.results[0]?.id;
      return id ? getContact(id) : null;
    },

    async searchContacts({ text, limit, offset }) {
      const term = text.trim();
      const pageLimit = Math.min(Math.max(Math.trunc(limit ?? 20) || 1, 1), 100);
      const pageOffset = Math.max(Math.trunc(offset ?? 0), 0);
      if (term.length < 2)
        return { results: [], total: 0, limit: pageLimit, offset: pageOffset };
      const found = await request<HsSearch>("crm/v3/objects/contacts/search", "POST", {
        query: term,
        properties: CONTACT_PROPS,
        sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
        limit: pageLimit,
        ...(pageOffset ? { after: String(pageOffset) } : {})
      });
      return {
        results: await Promise.all((found?.results ?? []).map((o) => mapContact(o))),
        total: found?.total ?? 0,
        limit: pageLimit,
        offset: pageOffset
      };
    },

    async getAccount(id) {
      if (!isHubspotId(id)) return null;
      const o = await request<HsObject>(
        `crm/v3/objects/companies/${id}?properties=${props(COMPANY_PROPS)}`
      );
      if (!o) return null;
      const p = o.properties;
      const account: CrmAccount = {
        id: o.id,
        provider: PROVIDER,
        externalUrl: link("0-2", o.id),
        // Every HubSpot company has an ID; the name can be blank, so fall back to the real ID, never an invented label.
        name: clean(p.name) ?? o.id,
        industry: humanize(p.industry),
        type: humanize(p.type),
        website: clean(p.website) ?? clean(p.domain),
        phone: clean(p.phone),
        billingAddress: address(p),
        ownerName: await ownerName(p.hubspot_owner_id),
        createdAt: clean(p.createdate) ?? o.createdAt ?? null,
        lastModifiedAt: clean(p.hs_lastmodifieddate) ?? o.updatedAt ?? null
      };
      return account;
    },

    async listAccountContacts(accountId, limit) {
      if (!isHubspotId(accountId)) return [];
      const company = await request<HsObjectWithAssociations>(
        `crm/v3/objects/companies/${accountId}?properties=name&associations=contacts`
      );
      const ids = [
        ...new Set((company?.associations?.contacts?.results ?? []).map((r) => r.id))
      ].slice(0, Math.min(Math.max(limit ?? 20, 1), 100));
      if (!company || !ids.length) return [];
      const batch = await request<HsBatch>("crm/v3/objects/contacts/batch/read", "POST", {
        properties: CONTACT_PROPS,
        inputs: ids.map((id) => ({ id }))
      });
      const account = { id: company.id, name: clean(company.properties.name) };
      return Promise.all((batch?.results ?? []).map((o) => mapContact(o, account)));
    },

    async listContactActivities(contactId, limit) {
      if (!isHubspotId(contactId)) return [];
      const pageLimit = Math.min(Math.max(Math.trunc(limit ?? 20) || 1, 1), 100);
      // One read returns the IDs of every associated engagement; then one batch read per type
      // (avoids the CRM search API's 5-requests-per-second limit).
      const contact = await request<HsObjectWithAssociations>(
        `crm/v3/objects/contacts/${contactId}?properties=email&associations=${ACTIVITY_OBJECTS.map((s) => s.object).join(",")}`
      );
      if (!contact) return [];
      const perType = await Promise.all(
        ACTIVITY_OBJECTS.map(async (spec) => {
          const ids = [
            ...new Set(
              (contact.associations?.[spec.object]?.results ?? []).map((r) => r.id)
            )
          ].slice(0, 100);
          if (!ids.length) return [];
          const batch = await request<HsBatch>(
            `crm/v3/objects/${spec.object}/batch/read`,
            "POST",
            {
              properties: engagementProps(spec),
              inputs: ids.map((id) => ({ id }))
            }
          );
          return Promise.all((batch?.results ?? []).map((o) => mapActivity(spec, o)));
        })
      );
      return perType
        .flat()
        .map((a) => ({ ...a, contactId }))
        .sort((a, b) =>
          (b.activityDate ?? b.createdAt ?? "").localeCompare(
            a.activityDate ?? a.createdAt ?? ""
          )
        )
        .slice(0, pageLimit);
    },

    async updateContact(id, patch) {
      if (!isHubspotId(id)) return null;
      const properties: Record<string, string> = {};
      for (const [key, hsField] of CONTACT_FIELD_MAP)
        if (patch[key] !== undefined) properties[hsField] = patch[key] ?? "";
      if (!Object.keys(properties).length) error("No contact fields to update");
      if (!(await getContact(id))) return null;
      await request(`crm/v3/objects/contacts/${id}`, "PATCH", { properties });
      return getContact(id);
    },

    async logActivity(draft) {
      const target = LOGGABLE[draft.type];
      if (!target)
        error(
          `Logging a ${draft.type} activity is not supported for HubSpot yet — use CALL, EMAIL, or TASK`
        );
      if (!isHubspotId(draft.contactId))
        error(`'${draft.contactId}' is not a valid HubSpot contact ID`);
      const date = draft.activityDate?.trim();
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
        error("activityDate must be YYYY-MM-DD");
      const hs_timestamp = date ? `${date}T12:00:00.000Z` : new Date().toISOString();
      const status =
        draft.status?.trim().toUpperCase().replace(/\s+/g, "_") ||
        (draft.type === "TASK" && draft.completed === false
          ? "NOT_STARTED"
          : "COMPLETED");
      const properties: Record<string, string> =
        draft.type === "CALL"
          ? {
              hs_timestamp,
              hs_call_title: draft.subject,
              hs_call_body: draft.description ?? "",
              hs_call_status: status,
              ...(draft.durationMinutes && draft.durationMinutes > 0
                ? { hs_call_duration: String(Math.round(draft.durationMinutes * 60_000)) }
                : {})
            }
          : draft.type === "EMAIL"
            ? {
                hs_timestamp,
                hs_email_subject: draft.subject,
                hs_email_text: draft.description ?? "",
                hs_email_direction: "EMAIL",
                hs_email_status: "SENT"
              }
            : {
                hs_timestamp,
                hs_task_subject: draft.subject,
                hs_task_body: draft.description ?? "",
                hs_task_status: status
              };
      const created = await request<HsObject>(`crm/v3/objects/${target.object}`, "POST", {
        properties,
        associations: [
          {
            to: { id: draft.contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: target.associationTypeId
              }
            ]
          }
        ]
      });
      if (!created?.id)
        error("HubSpot did not return an ID for the new activity", "PROVIDER_ERROR");
      const activity = await readEngagement(target.object, created.id);
      if (!activity)
        error(
          `HubSpot created activity ${created.id} but it could not be read back`,
          "PROVIDER_ERROR"
        );
      return { ...activity, contactId: draft.contactId };
    },

    async updateActivity(id, patch) {
      // Activity ids are "<object>:<id>" (see mapActivity); only tasks have a status and due date.
      const match = /^(calls|emails|meetings|tasks|notes):(\d{1,20})$/.exec(id);
      if (!match) return null;
      if (match[1] !== "tasks") error("Only tasks can be marked done or rescheduled");
      const properties: Record<string, string> = {};
      if (typeof patch.completed === "boolean")
        properties.hs_task_status = patch.completed ? "COMPLETED" : "NOT_STARTED";
      const date = patch.activityDate?.trim();
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error("activityDate must be YYYY-MM-DD");
        properties.hs_timestamp = `${date}T12:00:00.000Z`;
      }
      if (!Object.keys(properties).length)
        error("Nothing to update — pass completed or activityDate");
      if (!(await readEngagement("tasks", match[2]))) return null;
      await request(`crm/v3/objects/tasks/${match[2]}`, "PATCH", { properties });
      return readEngagement("tasks", match[2]);
    }
  };
}
