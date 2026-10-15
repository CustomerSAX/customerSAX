import type {
  CrmAccount,
  CrmActivity,
  CrmActivityDraft,
  CrmActivityUpdate,
  CrmContact,
  CrmContactPage,
  CrmContactSearchArgs,
  CrmContactUpdate
} from "../crm/types.js";

/**
 * Shared port for every CRM. Reads return null for "not found" and throw on real
 * failures; writes return the CRM's persisted state.
 */
export interface CrmProvider {
  getContact(id: string): Promise<CrmContact | null>;
  findContactByEmail(email: string): Promise<CrmContact | null>;
  searchContacts(args: CrmContactSearchArgs): Promise<CrmContactPage>;
  getAccount(id: string): Promise<CrmAccount | null>;
  listAccountContacts(accountId: string, limit?: number): Promise<CrmContact[]>;
  listContactActivities(contactId: string, limit?: number): Promise<CrmActivity[]>;
  updateContact(id: string, patch: CrmContactUpdate): Promise<CrmContact | null>;
  logActivity(draft: CrmActivityDraft): Promise<CrmActivity>;
  /** Updates a task (only tasks can be completed or rescheduled); null when it does not exist. */
  updateActivity(id: string, patch: CrmActivityUpdate): Promise<CrmActivity | null>;
}
