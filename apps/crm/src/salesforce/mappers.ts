/**
 * Salesforce record → CRM contract mapping. Pure functions: a field the record
 * doesn't carry maps to `null`, never to a placeholder.
 */
import type { CrmAccount, CrmActivity, CrmActivityType, CrmAddress, CrmContact } from "../crm/types.js";

type Named = { Name?: string | null } | null | undefined;

export type SfContact = {
  Id: string;
  FirstName?: string | null;
  LastName?: string | null;
  Name?: string | null;
  Email?: string | null;
  Phone?: string | null;
  MobilePhone?: string | null;
  Title?: string | null;
  AccountId?: string | null;
  Account?: Named;
  MailingStreet?: string | null;
  MailingCity?: string | null;
  MailingState?: string | null;
  MailingPostalCode?: string | null;
  MailingCountry?: string | null;
  Owner?: Named;
  CreatedDate?: string | null;
  LastModifiedDate?: string | null;
};

export type SfAccount = {
  Id: string;
  Name?: string | null;
  Industry?: string | null;
  Type?: string | null;
  Website?: string | null;
  Phone?: string | null;
  BillingStreet?: string | null;
  BillingCity?: string | null;
  BillingState?: string | null;
  BillingPostalCode?: string | null;
  BillingCountry?: string | null;
  Owner?: Named;
  CreatedDate?: string | null;
  LastModifiedDate?: string | null;
};

export type SfTask = {
  Id: string;
  Subject?: string | null;
  Description?: string | null;
  Status?: string | null;
  IsClosed?: boolean | null;
  ActivityDate?: string | null;
  TaskSubtype?: string | null;
  WhoId?: string | null;
  AccountId?: string | null;
  Owner?: Named;
  CreatedDate?: string | null;
};

export type SfEvent = Omit<SfTask, "Status" | "TaskSubtype" | "IsClosed">;

const PROVIDER = "salesforce";

function address(parts: Record<keyof CrmAddress, string | null | undefined>): CrmAddress | null {
  const mapped: CrmAddress = {
    street: parts.street ?? null,
    city: parts.city ?? null,
    state: parts.state ?? null,
    postalCode: parts.postalCode ?? null,
    country: parts.country ?? null,
  };
  return Object.values(mapped).some((value) => value !== null) ? mapped : null;
}

function recordUrl(instanceUrl: string, sobject: string, id: string) {
  return `${instanceUrl}/lightning/r/${sobject}/${id}/view`;
}

export function mapContact(record: SfContact, instanceUrl: string): CrmContact {
  return {
    id: record.Id,
    provider: PROVIDER,
    externalUrl: recordUrl(instanceUrl, "Contact", record.Id),
    firstName: record.FirstName ?? null,
    lastName: record.LastName ?? null,
    fullName: record.Name ?? null,
    email: record.Email ?? null,
    phone: record.Phone ?? null,
    mobilePhone: record.MobilePhone ?? null,
    title: record.Title ?? null,
    accountId: record.AccountId ?? null,
    accountName: record.Account?.Name ?? null,
    mailingAddress: address({
      street: record.MailingStreet,
      city: record.MailingCity,
      state: record.MailingState,
      postalCode: record.MailingPostalCode,
      country: record.MailingCountry,
    }),
    ownerName: record.Owner?.Name ?? null,
    createdAt: record.CreatedDate ?? null,
    lastModifiedAt: record.LastModifiedDate ?? null,
  };
}

export function mapAccount(record: SfAccount, instanceUrl: string): CrmAccount {
  return {
    id: record.Id,
    provider: PROVIDER,
    externalUrl: recordUrl(instanceUrl, "Account", record.Id),
    // Name is required on every Salesforce Account; the fallback only guards a
    // malformed response and uses the real id rather than an invented label.
    name: record.Name ?? record.Id,
    industry: record.Industry ?? null,
    type: record.Type ?? null,
    website: record.Website ?? null,
    phone: record.Phone ?? null,
    billingAddress: address({
      street: record.BillingStreet,
      city: record.BillingCity,
      state: record.BillingState,
      postalCode: record.BillingPostalCode,
      country: record.BillingCountry,
    }),
    ownerName: record.Owner?.Name ?? null,
    createdAt: record.CreatedDate ?? null,
    lastModifiedAt: record.LastModifiedDate ?? null,
  };
}

/** Task.TaskSubtype → contract type. A Task with no subtype is, truthfully, a TASK. */
function taskType(subtype: string | null | undefined): CrmActivityType {
  switch (subtype) {
    case "Call":
      return "CALL";
    case "Email":
    case "ListEmail":
      return "EMAIL";
    case "Task":
    case null:
    case undefined:
      return "TASK";
    default:
      return "OTHER";
  }
}

export function mapTask(record: SfTask): CrmActivity {
  return {
    id: record.Id,
    provider: PROVIDER,
    type: taskType(record.TaskSubtype),
    subject: record.Subject ?? null,
    description: record.Description ?? null,
    status: record.Status ?? null,
    completed: typeof record.IsClosed === "boolean" ? record.IsClosed : null,
    activityDate: record.ActivityDate ?? null,
    contactId: record.WhoId ?? null,
    accountId: record.AccountId ?? null,
    ownerName: record.Owner?.Name ?? null,
    createdAt: record.CreatedDate ?? null,
  };
}

export function mapEvent(record: SfEvent): CrmActivity {
  return {
    id: record.Id,
    provider: PROVIDER,
    type: "MEETING",
    subject: record.Subject ?? null,
    description: record.Description ?? null,
    status: null,
    completed: null,
    activityDate: record.ActivityDate ?? null,
    contactId: record.WhoId ?? null,
    accountId: record.AccountId ?? null,
    ownerName: record.Owner?.Name ?? null,
    createdAt: record.CreatedDate ?? null,
  };
}
