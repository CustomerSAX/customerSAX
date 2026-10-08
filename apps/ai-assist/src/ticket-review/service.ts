import { createHash, randomUUID } from "node:crypto";
import { prepareOrderAction } from "./order-action.js";
import { groundedPhone } from "./phone.js";
import type {
  Analysis,
  ContactCustomer,
  Review,
  ReviewStore,
  ReviewTicket,
  ReviewOrder,
  OrderFindings,
  OrderAction,
  Scope
} from "./types.js";

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status = 409
  ) {
    super(message);
  }
}
type Dependencies = {
  store: ReviewStore;
  ticket(id: string): Promise<ReviewTicket>;
  closeTicket(
    id: string,
    expectedLastModifiedAt: string,
    solution: string
  ): Promise<ReviewTicket | null>;
  draftResolution(action: NonNullable<Review["action"]>): Promise<string>;
  customer(id: string): Promise<ContactCustomer>;
  analyze(ticket: ReviewTicket): Promise<Analysis>;
  executeOrder?(
    order: ReviewOrder,
    action: OrderAction
  ): Promise<{ id: string; version: number }>;
  order?(reference: string): Promise<ReviewOrder | null>;
  analyzeOrder?(ticket: ReviewTicket, order: ReviewOrder): Promise<OrderFindings>;
  execute(
    action: NonNullable<Review["action"]>
  ): Promise<{ version: number; phone: string }>;
};
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fingerprint = (ticket: ReviewTicket) => digest(ticket);
const normalizedEmail = (email?: string | null) => email?.trim().toLowerCase() ?? "";

function orderOwnershipIssue(
  ticket: ReviewTicket,
  order: ReviewOrder,
  customer: ContactCustomer
): string | undefined {
  if (
    customer.id !== ticket.customerId ||
    !normalizedEmail(customer.email) ||
    normalizedEmail(customer.email) !== normalizedEmail(ticket.customerEmail)
  )
    return "The ticket customer does not match the current customer profile. Verify the customer email, correct the ticket customer link, and select their order again.";
  if (order.customerId)
    return order.customerId === customer.id
      ? undefined
      : "This order is linked to a different customer account. Confirm the order number with the customer and select an order belonging to the ticket customer.";
  if (normalizedEmail(order.customerEmail) !== normalizedEmail(customer.email))
    return "This order has no customer account link and its email does not match the verified customer profile. Confirm the customer and order association in commercetools before continuing.";
  // Guest/imported orders appear in the customer order selector by email.
  // This permits inquiry findings only; writes still require the customer ID.
  return undefined;
}
const now = () => new Date().toISOString();
const reviewId = (scope: Scope, ticketId: string) =>
  digest([scope.clientId, scope.projectKey, ticketId]);

export function createReviewService(deps: Dependencies) {
  async function change(
    review: Review,
    scope: Scope,
    patch: Partial<Review>,
    event: string
  ) {
    const updatedAt = now();
    return deps.store.change(
      review._id,
      review.revision,
      [review.status],
      { ...patch, updatedAt },
      {
        at: updatedAt,
        actor: scope.userEmail,
        event,
        revision: patch.revision ?? review.revision,
        ...(patch.action !== undefined ? { action: patch.action } : {}),
        ...(patch.orderAction ? { orderAction: patch.orderAction } : {}),
        ...(patch.resolutionNotes !== undefined
          ? { resolutionNotes: patch.resolutionNotes }
          : {})
      }
    );
  }

  async function load(scope: Scope, ticketId: string) {
    const review = await deps.store.get(reviewId(scope, ticketId));
    if (
      review &&
      ["analyzing", "executing", "closing"].includes(review.status) &&
      Date.now() - Date.parse(review.updatedAt) > 120000
    ) {
      return (
        (await change(
          review,
          scope,
          {
            status:
              review.status === "closing"
                ? "close_uncertain"
                : review.status === "executing"
                  ? "uncertain"
                  : "failed",
            explanation:
              review.status === "closing"
                ? "Ticket closure confirmation was interrupted. Check the ticket status before taking further action. The approved review is saved; no action will run again."
                : review.status === "executing"
                  ? "Execution confirmation was interrupted. Check the commerce record before taking further action; this proposal will not run again."
                  : "Analysis was interrupted. Try analyzing the ticket again."
          },
          "interrupted"
        )) ?? review
      );
    }
    return review;
  }

  async function ensureResolutionDraft(review: Review, scope: Scope): Promise<Review> {
    if (
      review.status !== "succeeded" ||
      !review.action ||
      !review.result ||
      review.resolutionDraft
    )
      return review;
    const action = review.action;
    let note = `Updated the phone number for ${action.customerEmail} on the customer address ${action.addressLabel} (ID: ${action.addressId}) in commercetools from ${action.previousPhone || "not set"} to ${review.result.phone}. The update was confirmed by commercetools.`;
    try {
      const generated = (await deps.draftResolution(action)).trim();
      if (generated && generated.length <= 4000) note = generated;
    } catch {
      /* A failed draft must not change the confirmed CT outcome. Use the factual fallback. */
    }
    return (
      (await change(review, scope, { resolutionDraft: note }, "resolution_drafted")) ??
      (await load(scope, review.ticketId))!
    );
  }

  async function prepare(
    scope: Scope,
    ticketId: string,
    refresh = false,
    addressId?: string
  ): Promise<Review> {
    const ticket = await deps.ticket(ticketId);
    if (ticket.id.startsWith("zendesk:") || ticket.id.startsWith("freshdesk:"))
      throw new ReviewError(
        "AI ticket actions currently support native tickets only.",
        400
      );
    const previous = await load(scope, ticketId);
    const hash = fingerprint(ticket);
    if (
      previous &&
      (previous.result ||
        previous.orderResult ||
        previous.findingsApproved ||
        ["analyzing", "executing", "uncertain"].includes(previous.status) ||
        (previous.fingerprint === hash && (!refresh || previous.status === "succeeded")))
    )
      return ensureResolutionDraft(previous, scope);

    const started: Review = {
      _id: reviewId(scope, ticketId),
      clientId: scope.clientId,
      projectKey: scope.projectKey,
      ticketId,
      fingerprint: hash,
      revision: randomUUID(),
      status: "analyzing",
      summary: "",
      explanation: "Reading the ticket and preparing a proposal…",
      action: null,
      targets: [],
      updatedAt: now(),
      audit: []
    };
    if (previous) {
      const patch: Partial<Review> = {
        ...started,
        approvedBy: undefined,
        approvedAt: undefined,
        result: undefined,
        orderProposal: undefined,
        orderAction: undefined,
        orderResult: undefined,
        findingsApproved: undefined,
        resolutionDraft: undefined,
        resolutionNotes: undefined,
        closeApprovedBy: undefined,
        closeApprovedAt: undefined
      };
      delete patch._id;
      delete patch.audit;
      const claimed = await change(previous, scope, patch, "analysis_started");
      if (!claimed) return (await load(scope, ticketId))!;
    } else if (
      !(await deps.store.insert({
        ...started,
        audit: [
          {
            at: now(),
            actor: scope.userEmail,
            event: "analysis_started",
            revision: started.revision
          }
        ]
      }))
    ) {
      return (await load(scope, ticketId))!;
    }

    try {
      if (ticket.category === "order_inquiry") {
        if (!ticket.orderNumber || !ticket.customerId)
          return (await change(
            started,
            scope,
            {
              status: "blocked",
              summary: ticket.subject,
              explanation:
                "Link the customer and order to prepare an order inquiry review."
            },
            "order_information_required"
          ))!;
        const order = await deps.order?.(ticket.orderNumber);
        const ownershipIssue = order
          ? orderOwnershipIssue(ticket, order, await deps.customer(ticket.customerId))
          : "The selected order could not be found in the active commerce project. Confirm the project and order number, reselect the associated order, then analyze again.";
        if (ownershipIssue)
          return (await change(
            started,
            scope,
            {
              status: "blocked",
              summary: ticket.subject,
              explanation: ownershipIssue
            },
            "order_not_verified"
          ))!;
        if (!deps.analyzeOrder) throw new Error("Order analysis unavailable");
        if (!order) throw new Error("Order unavailable");
        const findings = await deps.analyzeOrder(ticket, order);
        const proposed = prepareOrderAction(ticket, order, findings);
        return (await change(
          started,
          scope,
          {
            status:
              ticket.status.toLowerCase() === "closed" || proposed.reason
                ? "blocked"
                : "pending",
            orderAction: proposed.action,
            summary: findings.summary,
            orderProposal: {
              ...findings,
              orderId: order.id,
              orderNumber: ticket.orderNumber,
              fingerprint: digest(order),
              previousAddress: order.shippingAddress as
                Record<string, unknown> | undefined
            },
            explanation:
              proposed.reason ??
              (proposed.action
                ? "Approve the exact order change below after checking applicable business policy. Customer messages and refunds are not included."
                : "Review the findings, suggested next steps, and response draft. Approval records your review; customer messages must be handled separately.")
          },
          "order_proposal_prepared"
        ))!;
      }
      const analysis = await deps.analyze(ticket);
      const patch: Partial<Review> = {
        summary: analysis.summary,
        explanation: analysis.explanation,
        status: "blocked"
      };
      if (analysis.intent === "update_contact_number") {
        const source = `${ticket.subject}\n${ticket.message}`;
        const phone = groundedPhone(source, analysis.phone, analysis.evidence);
        if (!phone) {
          patch.explanation =
            "The requested new number could not be verified in the ticket. Add an explicit new contact number to the ticket before continuing.";
        } else if (!ticket.customerId) {
          patch.explanation =
            "Link the correct customer to this ticket before preparing a contact-number change.";
        } else {
          const customer = await deps.customer(ticket.customerId);
          if (
            customer.id !== ticket.customerId ||
            customer.email.toLowerCase() !== ticket.customerEmail.toLowerCase()
          ) {
            patch.explanation =
              "The linked customer does not match the ticket email. Correct the customer link before continuing.";
          } else {
            patch.targets = customer.targets;
            const target = addressId
              ? customer.targets.find((item) => item.id === addressId)
              : customer.targets.length === 1
                ? customer.targets[0]
                : undefined;
            if (!target)
              patch.explanation = customer.targets.length
                ? "Select the customer address whose phone number should change, then prepare the proposal."
                : "This customer has no address with a phone field to update. Add the appropriate customer address first.";
            else if (target.phone === phone)
              patch.explanation =
                "The selected address already has the requested number. No update is needed.";
            else {
              patch.status = "pending";
              patch.explanation =
                "On approval, update only the phone field on the selected customer address in commercetools. Other address fields and the ticket status stay unchanged.";
              patch.action = {
                customerId: customer.id,
                customerEmail: customer.email,
                addressId: target.id,
                addressLabel: target.label,
                expectedVersion: customer.version,
                previousPhone: target.phone,
                phone
              };
            }
          }
        }
      }
      return (await change(started, scope, patch, "proposal_prepared"))!;
    } catch {
      return (await change(
        started,
        scope,
        {
          status: "failed",
          explanation:
            "Could not prepare the proposal. Check AI Assist, the commerce service, and their configuration, then try again."
        },
        "analysis_failed"
      ))!;
    }
  }

  async function decide(
    scope: Scope,
    ticketId: string,
    revision: string,
    decision: "approve" | "decline"
  ) {
    const review = await load(scope, ticketId);
    if (!review || review.revision !== revision)
      throw new ReviewError("This proposal changed. Reload it before approving.");
    if (review.status !== "pending") return review; // repeat clicks never execute again
    if (decision === "decline")
      return (
        (await change(
          review,
          scope,
          {
            status: "declined",
            explanation: "Proposal declined. No customer changes were made."
          },
          "declined"
        )) ?? (await load(scope, ticketId))!
      );
    if (review.orderProposal) {
      const ticket = await deps.ticket(ticketId);
      const order = await deps.order?.(review.orderProposal.orderNumber);
      if (
        ticket.status.toLowerCase() === "closed" ||
        fingerprint(ticket) !== review.fingerprint ||
        !order ||
        digest(order) !== review.orderProposal.fingerprint ||
        !ticket.customerId ||
        orderOwnershipIssue(ticket, order, await deps.customer(ticket.customerId)) ||
        (review.orderAction && order.customerId !== ticket.customerId)
      )
        return (await change(
          review,
          scope,
          {
            status: "stale",
            explanation: "The ticket or order changed. Analyze again before approving."
          },
          "stale"
        ))!;
      if (review.orderAction) {
        if (!deps.executeOrder)
          throw new ReviewError("Order execution unavailable.", 503);
        const executing = await change(
          review,
          scope,
          {
            status: "executing",
            approvedBy: scope.userEmail,
            approvedAt: now(),
            explanation: "Approved. Applying the reviewed order change…"
          },
          "order_action_approved"
        );
        if (!executing) return (await load(scope, ticketId))!;
        try {
          const result = await deps.executeOrder(order, review.orderAction);
          if (result.id !== order.id || result.version <= (order.version ?? 0))
            throw new Error("Unconfirmed order update");
          const detail =
            review.orderAction.kind === "cancel_order"
              ? `Changed order ${review.orderProposal.orderNumber} from ${order.orderState} to Cancelled. No refund or customer notification was performed.`
              : `Updated shipping address on order ${review.orderProposal.orderNumber}. Previous address: ${JSON.stringify(order.shippingAddress)}. Approved address fields: ${JSON.stringify(review.orderAction.address)}. No customer notification was performed.`;
          return (await change(
            executing,
            scope,
            {
              status: "succeeded",
              orderResult: result,
              resolutionDraft: detail,
              explanation:
                "Commercetools confirmed the approved order change. Review the resolution notes and close the ticket if no follow-up remains."
            },
            "order_execution_succeeded"
          ))!;
        } catch {
          return (await change(
            executing,
            scope,
            {
              status: "uncertain",
              explanation:
                "The order change could not be confirmed. Check the order before taking further action; this proposal will not execute again."
            },
            "order_execution_unconfirmed"
          ))!;
        }
      }
      return (
        (await change(
          review,
          scope,
          {
            status: "succeeded",
            findingsApproved: true,
            approvedBy: scope.userEmail,
            approvedAt: now(),
            resolutionDraft: `Agent reviewed order ${review.orderProposal.orderNumber}.\n\n${review.summary}\n\nSuggested next steps (completion not verified):\n${review.orderProposal.actions.map((action) => `- ${action}`).join("\n")}\n\nResponse draft (not sent):\n${review.orderProposal.responseDraft}${review.orderProposal.missingInformation.length ? `\n\nOutstanding information:\n${review.orderProposal.missingInformation.join("\n")}` : ""}`,
            explanation:
              "Findings approved and saved. No order change or customer message was performed. Complete any required follow-up, then review the resolution notes before deciding whether to close."
          },
          "order_findings_approved"
        )) ?? (await load(scope, ticketId))!
      );
    }
    if (!review.action) throw new ReviewError("There is no executable action.");

    const ticket = await deps.ticket(ticketId);
    const customer = await deps.customer(review.action.customerId);
    const target = customer.targets.find((item) => item.id === review.action!.addressId);
    if (
      fingerprint(ticket) !== review.fingerprint ||
      customer.id !== review.action.customerId ||
      customer.email !== review.action.customerEmail ||
      customer.version !== review.action.expectedVersion ||
      target?.phone !== review.action.previousPhone
    ) {
      return (await change(
        review,
        scope,
        {
          status: "stale",
          explanation:
            "The ticket or customer changed since this proposal was prepared. Analyze again and review the new proposal."
        },
        "stale"
      ))!;
    }
    const executing = await change(
      review,
      scope,
      {
        status: "executing",
        approvedBy: scope.userEmail,
        approvedAt: now(),
        explanation: "Approved. Updating the selected contact number in CT…"
      },
      "approved"
    );
    if (!executing) return (await load(scope, ticketId))!;
    try {
      const result = await deps.execute(review.action);
      if (result.phone !== review.action.phone) throw new Error("Unconfirmed result");
      const completed = (await change(
        executing,
        scope,
        {
          status: "succeeded",
          result,
          explanation:
            "CT confirmed the contact-number update. Would you like to close this ticket as well?"
        },
        "execution_succeeded"
      ))!;
      return ensureResolutionDraft(completed, scope);
    } catch {
      // A timeout may occur after CT committed. Never automatically repeat a write.
      return (await change(
        executing,
        scope,
        {
          status: "uncertain",
          explanation:
            "CT did not confirm the outcome. Check the customer in CT before taking further action. This proposal will not be executed again."
        },
        "execution_unconfirmed"
      ))!;
    }
  }
  async function decideClosure(
    scope: Scope,
    ticketId: string,
    revision: string,
    decision: "approve_close" | "keep_open",
    resolutionNotes?: string
  ) {
    const review = await load(scope, ticketId);
    if (!review || review.revision !== revision)
      throw new ReviewError("This proposal changed. Reload it before approving closure.");
    if (
      review.status !== "succeeded" ||
      (!review.result && !review.orderResult && !review.findingsApproved)
    )
      return review;
    if (decision === "keep_open") {
      return (
        (await change(
          review,
          scope,
          {
            status: "kept_open",
            explanation:
              "You chose to keep the ticket open. The approved review is saved; the ticket status has not been changed."
          },
          "closure_declined"
        )) ?? (await load(scope, ticketId))!
      );
    }
    const solution = resolutionNotes?.trim();
    if (!solution || solution.length > 5000)
      throw new ReviewError(
        "Enter resolution notes between 1 and 5,000 characters before closing.",
        400
      );
    const ticket = await deps.ticket(ticketId);
    if (ticket.status.toLowerCase() === "closed") {
      return (
        (await change(
          review,
          scope,
          {
            status: "closed",
            explanation: "This ticket is already closed."
          },
          "already_closed"
        )) ?? (await load(scope, ticketId))!
      );
    }
    if (!ticket.lastModifiedAt || fingerprint(ticket) !== review.fingerprint) {
      return (
        (await change(
          review,
          scope,
          {
            status: "close_stale",
            explanation:
              "The ticket changed since approval. Review the latest conversation and use Ticket Workflow to close it if appropriate."
          },
          "closure_stale"
        )) ?? (await load(scope, ticketId))!
      );
    }
    if (review.orderProposal) {
      const order = await deps.order?.(review.orderProposal.orderNumber);
      if (
        !order ||
        (review.orderResult
          ? order.id !== review.orderResult.id ||
            order.version !== review.orderResult.version
          : digest(order) !== review.orderProposal.fingerprint)
      )
        return (await change(
          review,
          scope,
          {
            status: "close_stale",
            explanation:
              "The order changed after approval. Review the latest order and close through Ticket Workflow if appropriate."
          },
          "closure_stale"
        ))!;
    }
    const closing = await change(
      review,
      scope,
      {
        status: "closing",
        closeApprovedBy: scope.userEmail,
        closeApprovedAt: now(),
        resolutionNotes: solution,
        explanation: "Closure approved. Closing the ticket…"
      },
      "closure_approved"
    );
    if (!closing) return (await load(scope, ticketId))!;
    try {
      const closed = await deps.closeTicket(ticketId, ticket.lastModifiedAt, solution);
      if (!closed)
        return await change(
          closing,
          scope,
          {
            status: "close_stale",
            explanation:
              "The ticket changed before closure could be applied. Review the latest ticket and close it through Ticket Workflow if appropriate."
          },
          "closure_stale"
        );
      if (closed.status.toLowerCase() !== "closed")
        throw new Error("Closure was not confirmed");
      return await change(
        closing,
        scope,
        {
          status: "closed",
          explanation:
            "The ticket has been closed with your approval and resolution notes."
        },
        "ticket_closed"
      );
    } catch {
      return await change(
        closing,
        scope,
        {
          status: "close_uncertain",
          explanation:
            "The closure outcome could not be confirmed. Refresh the ticket to check its status before taking further action. The approved review is saved; no action will run again."
        },
        "closure_unconfirmed"
      );
    }
  }
  return { load, prepare, decide, decideClosure };
}
