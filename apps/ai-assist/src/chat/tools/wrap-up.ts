/**
 * Case wrap-up — the after-call work a rep does at the end of every case,
 * approved once and executed as one tool call:
 *
 *   1. add an internal note to the ticket (what happened)
 *   2. set the ticket's final status
 *   3. log the conversation on the customer's CRM contact
 *   4. optionally create an open CRM follow-up task for an agreed next step
 *
 * Runs server-side in a fixed order so a step can't be forgotten the way it
 * can when the model chains several write tools itself. Each step is checked
 * against the rep's permissions and reported individually; a failed step does
 * not stop the others, and the result never claims a step that didn't run.
 */

import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { getSystemPromptContext } from "../system-prompt.js";
import { instrumentTools } from "./instrument.js";
import { guardWriteTools } from "./write-guard.js";
import { addTicketNote, updateTicketFields } from "./tickets.js";
import { crmToolError, logCrmActivity } from "./crm.js";

const log = createLogger("ai-assist").child({ module: "tools/wrap-up" });

const APPROVAL_GATE_ERROR =
  "APPROVAL_GATE_BLOCKED: An action_approval confirmation card was shown earlier in this turn. " +
  "You must NOT call wrap_up_case until the agent explicitly clicks Approve in the UI. " +
  "Stop your response now and wait for the next user message.";

type StepResult = { step: string; ok: boolean; detail?: string; error?: string; crmNotConnected?: boolean };

const today = () => new Date().toISOString().slice(0, 10);

export function buildWrapUpTools(approvalGate?: { pending: boolean }) {
  const wrapUpCaseTool = tool({
    description:
      "Wrap up a case in one approved action: internal ticket note, final ticket status, CRM conversation log, and an optional CRM follow-up task. " +
      "ALWAYS present action_approval first (see the WRAP-UP playbook) and call this only after the rep approves, using the approved Values exactly. " +
      "Pass only the parts that apply; omit a part to skip it.",
    inputSchema: z.object({
      ticketId: z.string().optional().describe("Ticket id (not the ticket number) from this conversation"),
      ticketNote: z.string().optional().describe("Internal note for the ticket — what the customer needed and what was done"),
      ticketStatus: z.enum(["open", "in progress", "waiting", "resolved", "closed"]).optional().describe("Final ticket status"),
      crmContactId: z.string().optional().describe("CRM contact id from find_crm_contact in this conversation"),
      crmSummary: z.string().optional().describe("1-3 sentence summary to log on the CRM contact"),
      crmTopic: z.string().optional().describe("Short topic for the CRM subject, e.g. 'Damaged rug refund'"),
      interactionType: z.enum(["chat", "call"]).default("chat").describe("'call' only when the rep said it was a phone call"),
      callDurationMinutes: z.number().positive().optional().describe("Phone calls only, and only if the rep gave it"),
      followUpSubject: z.string().optional().describe("Agreed next step to track as an open CRM task, e.g. 'Confirm replacement delivered'"),
      followUpDueDate: z.string().optional().describe("Follow-up due date, YYYY-MM-DD")
    }),
    execute: async (input) => {
      if (approvalGate?.pending) return { error: APPROVAL_GATE_ERROR };

      const ctx = getSystemPromptContext();
      const results: StepResult[] = [];
      const ticketNote = input.ticketNote?.trim();
      const crmSummary = input.crmSummary?.trim();
      const followUpSubject = input.followUpSubject?.trim();

      // ── Ticket ───────────────────────────────────────────────────────────
      if ((ticketNote || input.ticketStatus) && !input.ticketId) {
        results.push({ step: "ticket", ok: false, error: "No ticket id was provided, so the ticket wasn't updated." });
      } else if (input.ticketId) {
        if (!ctx.canUpdateTickets) {
          results.push({ step: "ticket", ok: false, error: "PERMISSION DENIED: you only have read access to tickets." });
        } else {
          if (ticketNote) {
            try {
              const noted = await addTicketNote(input.ticketId, ticketNote, ctx.userEmail ?? "csa_assistant");
              results.push(
                noted
                  ? { step: "ticket_note", ok: true, detail: noted.ticketNumber ? `Ticket #${noted.ticketNumber}` : undefined }
                  : { step: "ticket_note", ok: false, error: "Ticket not found" }
              );
            } catch (err) {
              results.push({ step: "ticket_note", ok: false, error: String(err) });
            }
          }
          if (input.ticketStatus) {
            try {
              const updated = await updateTicketFields(input.ticketId, { status: input.ticketStatus });
              results.push(
                updated
                  ? { step: "ticket_status", ok: true, detail: `Status ${updated.status ?? input.ticketStatus}` }
                  : { step: "ticket_status", ok: false, error: "Ticket not found" }
              );
            } catch (err) {
              results.push({ step: "ticket_status", ok: false, error: String(err) });
            }
          }
        }
      }

      // ── CRM ──────────────────────────────────────────────────────────────
      if ((crmSummary || followUpSubject) && !input.crmContactId) {
        results.push({ step: "crm", ok: false, error: "No CRM contact id was provided, so nothing was logged to the CRM." });
      } else if (input.crmContactId) {
        if (!ctx.canUpdateCustomers) {
          results.push({ step: "crm", ok: false, error: "PERMISSION DENIED: you only have read access to customer records." });
        } else {
          if (crmSummary) {
            const isCall = input.interactionType === "call";
            try {
              const activity = await logCrmActivity({
                contactId: input.crmContactId,
                // A chat isn't a CRM "call"; record it as a completed task, as the CRM playbook does.
                type: isCall ? "CALL" : "TASK",
                subject: `Support case – ${input.crmTopic?.trim() || "conversation summary"}`,
                description: crmSummary,
                activityDate: today(),
                // Models tend to fill every optional field; a sub-minute "duration"
                // is filler, not something the rep said, so it is never logged.
                ...(isCall
                  ? input.callDurationMinutes && input.callDurationMinutes >= 1
                    ? { durationMinutes: Math.round(input.callDurationMinutes) }
                    : {}
                  : { completed: true })
              });
              results.push({ step: "crm_log", ok: true, detail: activity.subject });
            } catch (err) {
              results.push({ step: "crm_log", ok: false, ...crmToolError(err) });
            }
          }
          if (followUpSubject) {
            try {
              const task = await logCrmActivity({
                contactId: input.crmContactId,
                type: "TASK",
                subject: followUpSubject,
                activityDate: input.followUpDueDate?.trim() || undefined,
                completed: false
              });
              results.push({ step: "crm_follow_up", ok: true, detail: task.subject });
            } catch (err) {
              results.push({ step: "crm_follow_up", ok: false, ...crmToolError(err) });
            }
          }
        }
      }

      if (results.length === 0) {
        return { error: "Nothing to wrap up — no ticket or CRM details were provided.", results };
      }
      const failed = results.filter((r) => !r.ok).length;
      log.info("write:wrap_up_case", {
        targetId: input.ticketId ?? input.crmContactId,
        steps: results.map((r) => `${r.step}:${r.ok ? "ok" : "fail"}`).join(","),
        ok: failed === 0
      });
      return { completed: results.length - failed, failed, results };
    }
  });

  return instrumentTools(guardWriteTools({ wrap_up_case: wrapUpCaseTool }, approvalGate), log);
}
