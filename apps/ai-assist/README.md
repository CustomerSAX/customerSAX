# CSA AI Assist

Standalone Node.js AI assist service using Vercel AI Gateway.

## Run Independently

```bash
pnpm install
pnpm dev
```

This folder has its own `package.json`, `tsconfig.json`, and `Dockerfile`. It does not depend on monorepo-only packages.

## Required Env

- `AI_ASSIST_PORT`
- `AI_GATEWAY_API_KEY`
- `DEFAULT_LLM_PROVIDER`
- `OPENAI_MODEL`
- `ANTHROPIC_MODEL`
- `XAI_MODEL`
- `AI_COMMERCE_PLATFORM`
- `AI_COMMERCE_SERVICE_URL`

See `.env.example` in this folder.

## Native ticket proposals and approval

Opening a native ticket in Studio prepares a saved AI summary and proposal through
`POST /api/tickets/ai-review` → AI Assist `/ticket-review` → the federated BFF.
This is an on-demand workflow, not a background ticket-created subscription.
The model only summarizes and extracts an explicit contact-number request; it
has no write tools. Missing information and unsupported requests stay blocked.

The first supported action changes `phone` on one existing CT customer address.
The customer must be linked to the ticket and its email must match. Multiple
addresses require an explicit selection. The panel displays the address ID and
old/new numbers before the agent clicks **Approve & update CT**. After CT confirms
success, a separate **Approve & close ticket** / **Keep open** prompt appears.
Only the second approval closes the native ticket. Closure checks the saved
ticket snapshot and applies an atomic last-modified check, so intervening edits
block closure. The ticket view refreshes after closing. No customer message is sent.

Before closing, AI drafts editable Resolution / Solution Notes from the confirmed
CT action. Existing ticket notes are included for review. The agent's final text
is required (up to 5,000 characters), recorded with their closure approval, and
saved to `Ticket.solution` in the same atomic update as the Closed status. A model
failure uses a factual action summary and never changes a successful CT outcome.
Older completed reviews receive a draft when reopened.

AI Assist requires a configured model and `MONGO_URI` (or `MONGODB_URI`). Reviews
are saved in `csa_ticket_ai_reviews` in `MONGO_DB_NAME` / `MONGO_TICKETS_DB` / `csa`.
There is no in-memory approval fallback. Keep AI Assist private: its identity
headers are trusted only from the authenticated Studio proxy, as with chat.
Only agent/admin/superadmin sessions in an active client project can use the flow.

Approval is bound to a server-saved revision and tenant/project. The backend
rechecks the ticket, email, customer version and previous number, then atomically
claims execution. CT receives the expected version and a change-address action
that preserves all other address fields. Duplicate clicks do not repeat writes.
The review records proposal snapshots, approver, time and execution outcome.
Interrupted/uncertain writes stay blocked from retries and require checking CT
manually; there is no automatic reconciliation or rollback.

Closure decisions and the closing approver/time are persisted in the same review.
Completed CT actions are never re-run when a ticket status changes. If closure
is stale or unconfirmed, inspect the ticket and use Ticket Workflow to handle it.
This also works for previously completed AI reviews without a closure decision.

Build `@csa/commerce-contract` and restart the CT adapter and AI Assist after
deploying. The BFF must compose `customerContactTargets` and
`updateCustomerContactNumber`, plus ticketing's `closeTicketIfUnchanged` (local
schema polling discovers them automatically). Restart ticketing after deployment.
CT credentials require customer read/update access. No live CT writes are made by
the automated tests.


### Order inquiry review and execution

Creating a ticket opens its detail view, where native `order_inquiry` tickets receive a persisted summary, suggested next steps, missing information, and a customer response draft based on the verified linked commercetools order. Drafts are not sent to customers.

Agent approval either records informational findings or executes the exact saved order change. Cancellation is supported for Open/Confirmed orders with Pending/Ready shipment, Pending payment, and no linked payments. Shipping address changes require explicit address fields in the ticket and preserve country, state, and postal code; other destination changes need manual tax/shipping review. Agents must check business policy before approval. Refunds and customer notifications are not executed.

Order changes use the approved commercetools version and revalidate eligibility in the commerce service. Approval claims are atomic; uncertain writes cannot be repeated. Closing is a separate approval with editable resolution notes, ticket concurrency checks, and a fresh order check. Confirm outstanding follow-up is complete before closing informational inquiries.

The commerce subgraph must expose `orderReviewSnapshot` and `updateReviewedOrder`; restart the commerce service and federated gateway after this schema change. The AI Assist service must be running and configured as described above.
