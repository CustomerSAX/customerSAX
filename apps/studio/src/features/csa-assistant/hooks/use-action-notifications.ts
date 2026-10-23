"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { notify } from "@/features/notifications/notification-store";

type Part = { type: string; toolName?: string; toolCallId?: string; state?: string; input?: unknown; output?: unknown; errorText?: string };
type Rec = Record<string, unknown>;

const asRec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** First non-empty string at any of these keys, looking one level into nested objects too. */
function find(value: unknown, keys: string[]): string | undefined {
  const rec = asRec(value);
  for (const k of keys) if (str(rec[k])) return str(rec[k]);
  for (const v of Object.values(rec)) {
    const nested = asRec(v);
    for (const k of keys) if (str(nested[k])) return str(nested[k]);
  }
  return undefined;
}

/**
 * The write tools a rep cares about, each with the toast to show once it has
 * really run. Values come only from the tool's own input and result.
 */
const WRITE_TOASTS: Record<string, { done: (input: Rec, output: unknown) => { title: string; description?: string; variant?: "success" | "warning" }; failed: string }> = {
  cancel_order: {
    done: (i, o) => ({ title: "Order cancelled", description: find(o, ["orderNumber"]) ?? str(i.orderId) }),
    failed: "Couldn't cancel the order"
  },
  start_return: {
    done: (_i, o) => ({ title: "Return recorded", description: find(o, ["returnTrackingId"]) && `Tracking ${find(o, ["returnTrackingId"])}` }),
    failed: "Couldn't record the return"
  },
  place_order: {
    done: (_i, o) => ({ title: "Order placed", description: find(o, ["orderNumber"]) && `Order ${find(o, ["orderNumber"])}` }),
    failed: "Couldn't place the order"
  },
  update_order: {
    done: (_i, o) => ({ title: "Order updated", description: find(o, ["orderNumber"]) }),
    failed: "Couldn't update the order"
  },
  create_ticket: {
    done: (_i, o) => ({ title: "Ticket created", description: find(o, ["ticketNumber"]) && `Ticket #${find(o, ["ticketNumber"])}` }),
    failed: "Couldn't create the ticket"
  },
  update_ticket: {
    done: (i, o) => ({
      title: "Ticket updated",
      description: [find(o, ["ticketNumber"]) && `#${find(o, ["ticketNumber"])}`, str(i.status) && `status ${str(i.status)}`]
        .filter(Boolean)
        .join(" · ") || undefined
    }),
    failed: "Couldn't update the ticket"
  },
  add_ticket_note: {
    done: (_i, o) => ({ title: "Note added to ticket", description: find(o, ["ticketNumber"]) && `Ticket #${find(o, ["ticketNumber"])}` }),
    failed: "Couldn't add the note"
  },
  log_crm_activity: {
    done: (i, o) => ({ title: "Logged to CRM", description: find(o, ["subject"]) ?? str(i.subject) }),
    failed: "Couldn't log to the CRM"
  },
  update_crm_activity: {
    done: (i, o) => ({
      title: i.completed === true ? "Follow-up marked done" : str(i.activityDate) ? "Follow-up rescheduled" : "Follow-up updated",
      description: find(o, ["subject"])
    }),
    failed: "Couldn't update the follow-up"
  },
  wrap_up_case: {
    done: (_i, o) => {
      const out = asRec(o);
      const completed = typeof out.completed === "number" ? out.completed : 0;
      const failed = typeof out.failed === "number" ? out.failed : 0;
      return failed > 0
        ? { title: "Wrap-up partly done", description: `${completed} step${completed === 1 ? "" : "s"} done, ${failed} failed`, variant: "warning" }
        : { title: "Case wrapped up", description: `${completed} step${completed === 1 ? "" : "s"} done` };
    },
    failed: "Couldn't wrap up the case"
  },
  update_crm_contact: {
    done: (_i, o) => ({ title: "CRM contact updated", description: find(o, ["fullName", "email"]) }),
    failed: "Couldn't update the CRM contact"
  }
};

function toolName(p: Part) {
  if (p.type === "dynamic-tool") return p.toolName ?? "";
  return p.type.startsWith("tool-") ? p.type.slice(5) : "";
}

/**
 * Pops a notification when one of the assistant's write actions finishes in
 * a live reply. Tool calls that arrive any other way (a restored or reloaded
 * conversation) are recorded silently so old actions never re-announce.
 */
export function useActionNotifications(messages: UIMessage[], isLoading: boolean) {
  const seen = useRef<Set<string> | null>(null);
  const wasLoading = useRef(false);

  useEffect(() => {
    // The final tool result can land in the same update that ends the stream.
    const live = isLoading || wasLoading.current;
    wasLoading.current = isLoading;
    const parts = messages.flatMap((m) => (m.role === "assistant" ? ((m.parts ?? []) as Part[]) : []));
    const finished = parts.filter((p) => p.toolCallId && WRITE_TOASTS[toolName(p)] && (p.state === "output-available" || p.state === "output-error"));

    if (seen.current === null || !live) {
      seen.current = new Set([...(seen.current ?? []), ...finished.map((p) => p.toolCallId!)]);
      return;
    }

    for (const p of finished) {
      if (seen.current.has(p.toolCallId!)) continue;
      seen.current.add(p.toolCallId!);
      const spec = WRITE_TOASTS[toolName(p)];
      const error = p.state === "output-error" ? p.errorText : str(asRec(p.output).error);
      // A write blocked for lack of approval never ran — it is protocol, not a
      // failure (the assistant shows an approval card next).
      if (error?.startsWith("APPROVAL_GATE_BLOCKED") || error?.startsWith("APPROVAL_REQUIRED")) continue;
      if (error) {
        notify({ variant: "error", title: spec.failed, description: error.replace(/^Error:\s*/, "").slice(0, 200) });
      } else {
        const { title, description, variant } = spec.done(asRec(p.input), p.output);
        notify({ variant: variant ?? "success", title, description });
      }
    }
  }, [messages, isLoading]);
}
