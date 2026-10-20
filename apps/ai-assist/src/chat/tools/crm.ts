/**
 * CRM tools — provider-neutral. They call the CRM capability through the BFF
 * (ai-assist → BFF → crm subgraph → the tenant's CRM), so the model never knows
 * or cares whether the tenant runs Salesforce or another CRM.
 *
 * Reads are gated on `canViewCustomers`, writes on `canUpdateCustomers` plus the
 * per-request approval gate, mirroring the ticket write tools.
 */
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { bffQuery } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";
import { instrumentTools } from "./instrument.js";

const log = createLogger("ai-assist").child({ module: "tools/crm" });

const ADDRESS_FIELDS = "street city state postalCode country";
const CONTACT_FIELDS = `
  id provider externalUrl firstName lastName fullName email phone mobilePhone title
  accountId accountName mailingAddress { ${ADDRESS_FIELDS} } ownerName createdAt lastModifiedAt
`;
const ACCOUNT_FIELDS = `
  id provider externalUrl name industry type website phone billingAddress { ${ADDRESS_FIELDS} } ownerName
`;
const ACTIVITY_FIELDS = "id type subject description status completed activityDate ownerName createdAt";

const READ_DENIED = { error: "PERMISSION DENIED: You don't have access to customer records." };
const WRITE_DENIED = {
  error: "PERMISSION DENIED: You only have read access to customer records. Please reach out to the admin to perform write or update actions.",
};

const APPROVAL_GATE_ERROR =
  "APPROVAL_GATE_BLOCKED: An action_approval confirmation card was shown earlier in this turn. " +
  "You must NOT call any write tool (log_crm_activity, update_crm_contact, update_crm_activity) until the agent explicitly clicks " +
  "Approve in the UI. Stop your response now and wait for the next user message.";

/**
 * Tool error shape. A tenant with no CRM connected is a normal configuration
 * state, not an outage — flag it so the model can say so plainly.
 */
function toolError(err: unknown) {
  const message = String(err);
  return /No CRM is connected/i.test(message)
    ? { error: message, crmNotConnected: true }
    : { error: message };
}

export const findCrmContactTool = tool({
  description:
    "Find a customer's contact record in the CRM (Salesforce or whichever CRM this project uses). Prefer `email` for an exact match; use `query` for a name/phone/company search. Returns CRM contact ids for get_crm_contact_details.",
  inputSchema: z.object({
    email: z.string().optional().describe("Exact email address — preferred when known"),
    query: z.string().optional().describe("Free-text search (name, phone, company); at least 2 characters"),
    limit: z.number().optional().default(10),
  }),
  execute: async ({ email, query, limit }) => {
    if (!getSystemPromptContext().canViewCustomers) return READ_DENIED;
    try {
      if (email?.trim()) {
        const data = await bffQuery<{ crmContactByEmail: unknown }>(
          `query CrmContactByEmail($email: String!) { crmContactByEmail(email: $email) { ${CONTACT_FIELDS} } }`,
          { email: email.trim() }
        );
        return data.crmContactByEmail ? { results: [data.crmContactByEmail] } : { results: [], note: "No CRM contact has this email." };
      }
      if (!query?.trim()) return { error: "Provide an email or a search query." };
      const data = await bffQuery<{ searchCrmContacts: { results: unknown[]; total: number | null } }>(
        `query SearchCrmContacts($text: String!, $limit: Int) {
          searchCrmContacts(text: $text, limit: $limit) { results { ${CONTACT_FIELDS} } total }
        }`,
        { text: query.trim(), limit }
      );
      return data.searchCrmContacts;
    } catch (err) {
      return toolError(err);
    }
  },
});

export const getCrmContactDetailsTool = tool({
  description:
    "Get a CRM contact's full picture: profile, their company account, and recent CRM activity (calls, emails, tasks, meetings). Use after find_crm_contact.",
  inputSchema: z.object({
    contactId: z.string().describe("CRM contact id from find_crm_contact"),
    activityLimit: z.number().optional().default(10),
  }),
  execute: async ({ contactId, activityLimit }) => {
    if (!getSystemPromptContext().canViewCustomers) return READ_DENIED;
    try {
      const data = await bffQuery<{ crmContact: { accountId?: string | null } | null; crmContactActivities: unknown[] }>(
        `query CrmContactDetails($id: ID!, $limit: Int) {
          crmContact(id: $id) { ${CONTACT_FIELDS} }
          crmContactActivities(contactId: $id, limit: $limit) { ${ACTIVITY_FIELDS} }
        }`,
        { id: contactId, limit: activityLimit }
      );
      if (!data.crmContact) return { error: "CRM contact not found" };

      let account: unknown = null;
      if (data.crmContact.accountId) {
        const accountData = await bffQuery<{ crmAccount: unknown }>(
          `query CrmAccount($id: ID!) { crmAccount(id: $id) { ${ACCOUNT_FIELDS} } }`,
          { id: data.crmContact.accountId }
        );
        account = accountData.crmAccount;
      }
      return {
        contact: data.crmContact,
        account,
        recentActivities: data.crmContactActivities,
        // The studio shows this contact's card and open follow-ups (with action
        // buttons) straight from this result.
        displayed:
          "The rep can already see this contact's CRM card (name, title, company, owner, email, phone, last activity) and the list of open follow-ups with Mark done / Reschedule / Log update / Draft email buttons. " +
          "Do NOT restate those details or list the follow-ups. Reply with ONE short line (e.g. 'Testing One has 1 open follow-up — overdue since 11 Oct.')."
      };
    } catch (err) {
      return toolError(err);
    }
  },
});

export type CrmActivityInput = {
  contactId: string;
  type: "CALL" | "EMAIL" | "TASK";
  subject: string;
  description?: string;
  activityDate?: string;
  durationMinutes?: number;
  completed?: boolean;
};

/** Records an activity on a CRM contact. Callers own permission/approval checks. */
export async function logCrmActivity(input: CrmActivityInput): Promise<{ id: string; subject?: string }> {
  const data = await bffQuery<{ logCrmActivity: { id: string; subject?: string } }>(
    `mutation LogCrmActivity($input: CrmActivityInput!) { logCrmActivity(input: $input) { ${ACTIVITY_FIELDS} } }`,
    { input }
  );
  return data.logCrmActivity;
}

/** Same error shape the CRM tools return — flags "no CRM connected" as configuration, not an outage. */
export { toolError as crmToolError };

export function buildCrmTools(approvalGate?: { pending: boolean }) {
  const logCrmActivityTool = tool({
    description:
      "Record an interaction on the customer's CRM contact (e.g. a call summary or follow-up task). ALWAYS require action_approval first.",
    inputSchema: z.object({
      contactId: z.string().describe("CRM contact id"),
      type: z.enum(["CALL", "EMAIL", "TASK"]).describe("CALL for a phone conversation, EMAIL for an email exchange, TASK for a follow-up"),
      subject: z.string().describe("Short subject line"),
      description: z.string().optional().describe("What happened / what needs doing"),
      activityDate: z.string().optional().describe("YYYY-MM-DD; defaults to today. For an open TASK this is its due date"),
      durationMinutes: z
        .number()
        .positive()
        .optional()
        .describe("CALL only: how many minutes the call lasted. Zoho CRM requires it; ask the rep instead of guessing"),
      completed: z
        .boolean()
        .optional()
        .describe("TASK only: false to create an open follow-up the team still has to do; omit or true to record it as done"),
    }),
    execute: async (input) => {
      if (approvalGate?.pending) return { error: APPROVAL_GATE_ERROR };
      if (!getSystemPromptContext().canUpdateCustomers) return WRITE_DENIED;
      try {
        const activity = await logCrmActivity(input);
        log.info("write:log_crm_activity", { targetId: activity.id, ok: true });
        return activity;
      } catch (err) {
        log.info("write:log_crm_activity", { ok: false });
        return toolError(err);
      }
    },
  });

  const updateCrmActivityTool = tool({
    description:
      "Mark an open CRM follow-up task as done (completed: true), reopen it (completed: false), or move its due date (activityDate). Only tasks can be updated. Use the activity id from get_crm_contact_details in THIS turn. ALWAYS require action_approval first.",
    inputSchema: z.object({
      activityId: z.string().describe("Task id from get_crm_contact_details (recentActivities[].id)"),
      completed: z.boolean().optional().describe("true = mark done, false = reopen"),
      activityDate: z.string().optional().describe("New due date, YYYY-MM-DD")
    }),
    execute: async ({ activityId, ...input }) => {
      if (approvalGate?.pending) return { error: APPROVAL_GATE_ERROR };
      if (!getSystemPromptContext().canUpdateCustomers) return WRITE_DENIED;
      try {
        const data = await bffQuery<{ updateCrmActivity: { id: string } | null }>(
          `mutation UpdateCrmActivity($id: ID!, $input: CrmActivityUpdateInput!) {
            updateCrmActivity(id: $id, input: $input) { ${ACTIVITY_FIELDS} }
          }`,
          { id: activityId, input }
        );
        log.info("write:update_crm_activity", { targetId: activityId, ok: data.updateCrmActivity != null });
        return data.updateCrmActivity ?? { error: "CRM task not found" };
      } catch (err) {
        log.info("write:update_crm_activity", { targetId: activityId, ok: false });
        return toolError(err);
      }
    }
  });

  const updateCrmContactTool = tool({
    description:
      "Update fields on the customer's CRM contact (name, email, phone, mobile, title). Only pass fields that change. ALWAYS require action_approval first.",
    inputSchema: z.object({
      contactId: z.string().describe("CRM contact id"),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      mobilePhone: z.string().optional(),
      title: z.string().optional(),
    }),
    execute: async ({ contactId, ...input }) => {
      if (approvalGate?.pending) return { error: APPROVAL_GATE_ERROR };
      if (!getSystemPromptContext().canUpdateCustomers) return WRITE_DENIED;
      try {
        const data = await bffQuery<{ updateCrmContact: unknown }>(
          `mutation UpdateCrmContact($id: ID!, $input: CrmContactUpdateInput!) {
            updateCrmContact(id: $id, input: $input) { ${CONTACT_FIELDS} }
          }`,
          { id: contactId, input }
        );
        log.info("write:update_crm_contact", { targetId: contactId, ok: data.updateCrmContact != null });
        return data.updateCrmContact ?? { error: "CRM contact not found" };
      } catch (err) {
        log.info("write:update_crm_contact", { targetId: contactId, ok: false });
        return toolError(err);
      }
    },
  });

  return instrumentTools(
    {
      find_crm_contact: findCrmContactTool,
      get_crm_contact_details: getCrmContactDetailsTool,
      log_crm_activity: logCrmActivityTool,
      update_crm_contact: updateCrmContactTool,
      update_crm_activity: updateCrmActivityTool,
    },
    log
  );
}
