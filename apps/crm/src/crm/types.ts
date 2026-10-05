// Provider-neutral CRM records. Field names match the GraphQL schema in
// ../schema.ts. A value the CRM doesn't hold is null — never a placeholder.

export type CrmAddress = {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type CrmAccount = {
  id: string;
  provider: string;
  externalUrl: string | null;
  name: string;
  industry: string | null;
  type: string | null;
  website: string | null;
  phone: string | null;
  billingAddress: CrmAddress | null;
  ownerName: string | null;
  createdAt: string | null;
  lastModifiedAt: string | null;
};

export type CrmContact = {
  id: string;
  provider: string;
  externalUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  title: string | null;
  accountId: string | null;
  accountName: string | null;
  mailingAddress: CrmAddress | null;
  ownerName: string | null;
  createdAt: string | null;
  lastModifiedAt: string | null;
};

export type CrmActivityType = "CALL" | "EMAIL" | "TASK" | "MEETING" | "OTHER";

export type CrmActivity = {
  id: string;
  provider: string;
  type: CrmActivityType;
  subject: string | null;
  description: string | null;
  status: string | null;
  activityDate: string | null;
  contactId: string | null;
  accountId: string | null;
  ownerName: string | null;
  createdAt: string | null;
};

export type CrmContactPage = {
  results: CrmContact[];
  /** null when the CRM cannot report a total (e.g. Salesforce SOSL) — never guessed. */
  total: number | null;
  limit: number;
  offset: number;
};

export type CrmContactSearchArgs = { text: string; limit?: number; offset?: number };

export type CrmContactUpdate = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  title?: string | null;
};

export type CrmActivityDraft = {
  contactId: string;
  type: CrmActivityType;
  subject: string;
  description?: string | null;
  status?: string | null;
  activityDate?: string | null;
};
