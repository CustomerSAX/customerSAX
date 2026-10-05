import type {
  CrmAccount,
  CrmActivity,
  CrmActivityDraft,
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
  listContactActivities(contactId: string, limit?: number): Promise<CrmActivity[]>;
  updateContact(id: string, patch: CrmContactUpdate): Promise<CrmContact | null>;
  logActivity(draft: CrmActivityDraft): Promise<CrmActivity>;
}
