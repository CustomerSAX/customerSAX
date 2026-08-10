# CSA Assistant — Status Report & Action Plan

**Scope:** `apps/ai-assist` + `apps/webapp/src/features/csa-assistant` (branch `feature/ai-assistant`)
**Compared against:** the original `ct-csa-standalone` app (`src/ui/dashboard/` + `lib/ai/`)
**Method:** full source read of both codebases, `tsc --noEmit` on both new apps, and live end-to-end testing against the running services (ai-assist :8080, BFF :4000, commercetools subgraph :4310, ticketing :4350, webapp :3000).

---

## 1. Old app — what it actually is (reference)

`ct-csa-standalone`'s CSA Assistant is a mature, production-hardened system:

- **`lib/ai/system-prompt.ts`** (685 lines) — persona/tone rules with a banned-jargon list, mandatory `update_ui_state` on every turn, an intent classifier, ~13 sub-playbooks (Identity, Order, Tickets, Cancel, Refund/Return, Place Order — a 6-gate customer-first flow, Update Customer, Replacement, Edit Order), response-style rules, and per-outcome phrasing templates (success/not-found/no-permission/system-error/emotional). Split into a cacheable static block + a per-request dynamic block (session table, ACL permissions, page-context pre-fetch instructions).
- **`lib/ai/tool-adapter.ts`** — ACL write-tool stripping, canonical-capability hiding of raw `ct_*` reads, argument sanitization (UUID-vs-orderNumber, store-scope stripping), result truncation, and automatic `cartId`/`ticketId` recovery from conversation history.
- **`lib/ai/ui-tools.ts`** — 11 no-op "generative UI" pseudo-tools the model calls to drive cards (`cart_summary`, `order_summary`, `product_card`, `action_approval`, `case_briefing_card`, etc.).
- **Real MCP tool sources**: Agent Connect gateway → `curated-mcp-server` (14 commerce tools, **propose→confirm_action with a server-generated confirmation token** for every destructive write) + `tickets-mcp-server` (8 ticket/KB tools) + a raw `ct_*` escape hatch.
- **`src/ui/dashboard/`** — `CSADashboard.tsx` 3-pane shell (conversations / chat / context+steppers), 3 steppers (Create Order, Create Ticket, Return) driven entirely by scraping the AI SDK's tool-call stream into a Zustand `ConversationStore`, `stepper-shared/` (real `/api/customers/search` + `/api/orders` reads), `dashboard.css` (~2,400 lines, the full visual system).
- **Safety model**: destructive writes are protected server-side, not just by prompt instruction.
- **Memory**: 3-tier — Redis working memory, MongoDB episodic memory, vector semantic memory (built but dormant).

---

## 2. New app — current true state (verified, not assumed)

### What's real and working (live-tested)

| Piece | Verified how |
|---|---|
| `ai-assist` service | `GET /health` → `status: ok`, OpenAI provider configured |
| Full chat pipeline | Sent a live message → got a real streamed LLM reply through `webapp → ai-assist → streamText → tools → BFF` |
| Prompt discipline | On a failed lookup, the model said *"I couldn't retrieve the customer details... Please verify the email address"* — correctly following the "never show raw errors" rule |
| Ticketing federation | Queried the BFF directly: `{ ticketPage(limit:1) { total } }` → **74 real tickets**. `apps/bff`'s `FEDERATED_SERVICES` does include `ticketing` at :4350 — this path is real end to end |
| `ConversationList` | Rendered all 74 real tickets grouped by customer (e.g. correctly shows "9 open tickets" nested for a repeat customer), matching the old app's grouping logic |
| Design system | `packages/ui` (`@csa/ui`) is a genuine, complete port of the old Meridian library — same category structure (primitives/data-display/navigation/overlays/layout/feedback) |
| Steppers | `CreateOrderStepper.tsx`/`CreateTicketStepper.tsx`/`ReturnStepper.tsx` + `stepper-shared/` are line-for-line ports of the old app's files |
| `ConversationStore` (Zustand) | Same workflow-snapshot pattern as the old `ConversationStore` — `OrderWorkflowSnapshot`/`TicketWorkflowSnapshot`/`ReturnWorkflowSnapshot`, near-identical field names |
| Tool coverage | 20 real commerce tools now (up from an earlier 8) — adds B2B (`find_b2b_customer`, `b2b_orders`, `b2b_carts`), `cancel_order`, `start_return`, `check_return_eligibility`, `update_order`, `list_regions` — plus 4 real ticket tools |

### ~~Confirmed broken~~ — FIXED, revalidated live (2026-08-08)

1. ~~`create_ticket` fails on every call~~ — **fixed**. `ctx.permissions.canUpdateTickets` → `ctx.canCreateTickets`/`ctx.canUpdateTickets` (the fix went further than my suggestion — `createTicketTool` now correctly checks the *create* flag, not the *update* flag). `tsc --noEmit` is clean on both apps. Live-tested: asked the assistant to create a ticket, got back *"The support ticket has been created successfully — Ticket Number: CSA-20260808-O0W8G"*, a real ticket number from the real service.
2. ~~`rightPanelTab` type gap~~ — **fixed**. The store's type now includes `"memory"`.

### TypeScript errors present right now (both apps fail `tsc --noEmit`)

**`ai-assist`** — the 2 errors above.

**`webapp`** (current, just re-checked):
- `ChatStream.tsx` — 4 unused imports (`Card`, `CardContent`, `CardHeader`, `CardTitle`) — harmless, just needs cleanup (component was refactored away from using these)
- `ContextPanel.tsx:198-199` — **`rightPanelTab` type gap**: the store's type is `"intelligence" | "chatHistory"` only, but `ContextPanel` now compares/sets it to `"memory"` (for the new Memory tab). This is a real hole, not noise — the Memory tab was wired into the UI without updating the store's type, so TypeScript can't verify that path is sound.
- `MemoryPanel.tsx:66`, `CreateOrderStepper.tsx:171` — unused variables, cosmetic

Neither error set blocks `next dev` (Next tolerates type errors at runtime) but **both will fail a production `next build` / `tsc` CI gate**.

### Working but disconnected from real data

- **Stepper browse/search is fully mocked.** `apps/webapp/src/app/api/{customers/search,orders,product-search,shipping-methods,agent-registry/users}/route.ts` all return **hardcoded fixed arrays** (4 fake customers, 2 fake orders, 4 fake products, 3 fake shipping methods, 4 fake agents) — not the commerce BFF. Net effect: the chat's own tools (`find_customer`, `get_order`, `search_products`) hit real CommerceTools data, but the stepper's "search for a customer/order/product" UI shows the same fixed fake records no matter what you type. Two different sources of truth for what should be the same lookup.
- **Write safety is prompt-only.** `place_order`/`cancel_order`/`start_return` execute immediately when the tool is called (verified by reading `commerce.ts`) — no server-side confirmation token like the old app's `confirm_action`. The only guard is the system prompt's text instruction. A model mistake or prompt injection has no backstop.

### Not implemented at all

- `ChatHistory.tsx` and `MemoryPanel.tsx` are fully built UI, but call `/api/chat`, `/api/chat/sessions`, `/api/memory` — **none of these routes exist anywhere in the monorepo**. They degrade gracefully to their built-in empty/error states, not a crash — but there's no session persistence and no real memory system behind them.
- Real auth/session — `agent@csa.local` and a fixed `projectKey` are hardcoded in `index.tsx`.
- Page-context awareness — `pageContext` is always `null`, never wired to actual page navigation.
- `process_refund` as a distinct capability (folded into `start_return`'s `addReturnInfo`), `search_knowledge_base`/KB backend.

---

## 3. Side-by-side comparison

| Dimension | Old app | New app |
|---|---|---|
| System prompt | 685 lines, ~13 sub-playbooks, exhaustive edge cases | 419 lines, 9 playbooks, condensed — same shape, less depth |
| `workflowStage`/`sentiment` vocabulary | `OPEN/UNDERSTAND/...`, `Positive/Neutral/Slightly Negative/...` | `greeting/identifying_customer/...`, `positive/neutral/concerned/...` — **different enums, not compatible if anything downstream assumes the old values** |
| Write safety | Server-side confirmation token (`confirm_action`) | Prompt-only instruction, no server enforcement |
| Ticket backend | MongoDB via `tickets-mcp-server` | MongoDB via `apps/ticketing` (federated through BFF) — **real, confirmed working** |
| Commerce tools | 14 curated + raw `ct_*` escape hatch | 20 tools, direct in `ai-assist`, no raw escape hatch |
| Stepper browse data | Real (`/api/customers/search`, `/api/orders` hit CT) | **Fake/hardcoded** |
| Memory | 3-tier, working + episodic real, semantic dormant | None — UI built, zero backend |
| Session/auth | Real NextAuth + ACL | Hardcoded |
| Design system | Meridian (`components/ui`) | `@csa/ui` — faithful port |
| Layout | Flexbox + CSS classes | CSS Grid, same pixel proportions (300px/450px) |

---

## 4. Action plan (priority order)

### P0 — fix now (breaks real functionality today)
1. **Fix `ctx.permissions.canUpdateTickets` → `ctx.canUpdateTickets`** in `apps/ai-assist/src/chat/tools/tickets.ts` (2 lines, both `createTicketTool` and `updateTicketTool`). Unblocks ticket creation/updates entirely.
2. **Add `"memory"` to the `rightPanelTab` union type** in `store/conversation-store.ts` so `ContextPanel.tsx`'s Memory tab type-checks and is actually sound.

### P1 — before this ships to anyone real
3. **Point the 5 mock stepper API routes at real data.** Either proxy them to the commerce BFF (matching what `ai-assist`'s own tools already do) or clearly label them as demo/seed data if that's intentional for now — right now it's a silent inconsistency, not a documented choice.
4. **Decide on write-safety**: either accept prompt-only enforcement as a known, documented risk for this phase, or port the old app's propose→confirm-token pattern for `place_order`/`cancel_order`/`start_return` before any real order/customer data is at risk.
5. Clean up the `webapp` unused-import errors (`ChatStream.tsx`) so `tsc --noEmit` is clean on both apps — cheap, unblocks CI.

### P2 — build out what's UI-only right now
6. Stand up `/api/chat` + `/api/chat/sessions` in `ai-assist` (session persistence) so `ChatHistory.tsx` has something real to show — it's fully built and waiting.
7. Stand up `/api/memory` (start with working memory only — Redis or even an in-memory per-session store) so `MemoryPanel.tsx` has something real to show.
8. Wire real session/auth context into `index.tsx` instead of the hardcoded `agent@csa.local`.
9. Wire `pageContext` from actual page navigation instead of always `null`.

### P3 — parity/polish
10. Reconcile the `workflowStage`/`sentiment` vocabulary with the old app's if any other system will ever need to read these values.
11. Add `process_refund` as its own capability if the business needs it distinct from `start_return`.
12. Port `search_knowledge_base` once/if a KB backend exists.

---

*Generated from a live-tested audit — every "working" claim above was verified against the running services, not assumed from reading code.*
