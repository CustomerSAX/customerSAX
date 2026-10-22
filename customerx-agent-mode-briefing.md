# CustomerX Agent Mode --- Product Brief & Implementation Plan

## 1. Instructions for Antigravity

Implement this feature **only within the Customer Success Studio
application** in the monorepo.

### Mandatory repository scope

-   Start by locating and inspecting the Customer Success Studio app and
    the code directly relevant to its existing AI assistant, navigation,
    authentication/session handling, ticketing, orders, quotes, and
    API/tool integrations.
-   Keep exploration and changes scoped to the Studio app and the shared
    packages it demonstrably depends on.
-   Do **not** perform a monorepo-wide audit.
-   Do **not** inspect, analyze, modify, or build for unrelated web
    apps, Rep Motion, other products, or unrelated services unless a
    concrete dependency is proven necessary.
-   Do not duplicate existing functionality. Reuse the Studio's current
    AI assistant/chat implementation, established design system,
    existing API clients, authorization patterns, and tool integrations
    where appropriate.
-   Before editing, report the relevant Studio entry points and
    dependencies you found, then proceed with the implementation. Do not
    stop at a plan or a visual mockup.

## 2. Product vision

Build **CustomerX Agent Mode**: a full-screen, AI-first workspace where
customer service agents can eventually handle their day-to-day work
through chat and task execution, without routinely navigating the legacy
Customer Success portal modules.

The goal is not another chatbot that merely recommends what a human
should do. The AI should investigate a selected task, gather only
relevant information, prepare a complete proposed resolution, and
present it for the agent to review. The agent approves by clicking
**Execute**, after which CustomerX performs the approved actions and
reports the actual outcome.

The long-term goal is that the agent can search, investigate, and
perform supported work across tickets, orders, quotes, customers, carts,
and products from Agent Mode. The old portal remains available as a
fallback for work that genuinely needs it.

## 3. Experience and UI requirements

### Entry and layout

-   Add an **Agent Mode** entry point in the existing Customer Success
    Studio.
-   Selecting it navigates to a dedicated **full-screen page/route**.
    This is not a popover, modal, floating widget, half-screen drawer,
    or overlay over the old portal.
-   The Agent Mode page fills the available application viewport and has
    two primary regions:
    -   **Left:** chat/assistant panel, reusing the existing Studio AI
        assistant implementation where possible.
    -   **Right:** a minimal workspace that initially shows compact
        priorities and task summaries, then shows details for the
        selected task.
-   Preserve the existing authentication, session, tenant/organization
    context, permissions, and application conventions.
-   Provide a clear way to return to the Customer Success portal.
-   Avoid creating a second, incompatible chat implementation if the
    existing assistant can be reused or adapted.

### Visual principles

-   Minimal, calm, low-clutter interface. Avoid a traditional dense
    dashboard.
-   The initial screen should have generous empty space. Show only a
    small number of compact priority indicators and actionable items.
-   Prioritize tickets first, orders second, quotes third. Customer,
    cart, and product tasks are secondary and should not dominate the
    landing view.
-   Use the existing Studio design system and styling conventions rather
    than introducing a new UI library or visual language.
-   Do not fill the initial screen with long AI summaries, detailed
    records, large charts, or generated content that nobody has
    requested.
-   Use clear loading, empty, error, stale-data, confirmation, and
    success/failure states.
-   Make the interface responsive and accessible, consistent with the
    Studio's current conventions.

## 4. Core interaction model: overview first, investigate on demand

### Initial page load

When the agent opens Agent Mode: - Fetch only the minimal metadata
required to render a useful overview: compact task identifiers, type,
status, priority, SLA/deadline indicators, assignment, and counts or
summaries where supported by existing APIs. - Use deterministic
backend/business rules to rank and filter urgent work when possible. Do
not call an LLM just to sort a task list. - Do not fetch full details
for every ticket, order, quote, customer, cart, or product. - Do not run
AI analysis on all visible items. - Do not automatically call every
available tool/API or create a large daily briefing. - Do not generate
AI summaries for tasks that the agent may never open. - Paginate or
limit lists as appropriate. Respect existing access control and tenant
scoping.

The overview should quickly answer: **"What needs my attention?"** It
should not attempt to answer every possible question before the agent
chooses a task.

### Task selection and analysis

When the agent explicitly selects a task or chooses **Analyze**: 1.
Fetch the selected record's details. 2. Identify related records from
reliable identifiers and relationships. 3. Call only the APIs/tools
needed for that specific task. 4. Retrieve only relevant
customer/order/shipment/quote/product/policy data. 5. Use the AI
assistant to investigate the gathered evidence and propose a resolution.
6. Display the findings, sources/identifiers, proposed actions, and a
draft customer response where relevant. 7. Do not execute
business-changing actions during analysis.

Examples: - For a "Where is my order?" ticket, load that ticket,
identify the customer and relevant order, and retrieve current shipment
status and ETA. Do not fetch the customer's entire order history unless
required. - For a return request, load the ticket and order, then
retrieve the applicable return eligibility/policy and item availability
data needed to decide the next step. - For a quote inquiry, load the
selected quote and the related ticket/customer information only when
relevant.

If the selected task is ambiguous, missing a required identifier, or
lacks sufficient evidence, ask a focused follow-up question or clearly
identify what is missing. Never invent facts, policies, reasons for
delay, delivery dates, prices, discounts, or eligibility.

### Execute

-   Show a clear **Execute** button only when the proposed plan is
    sufficiently grounded and executable.
-   The right-side workspace should show what will happen before
    execution: for example, send a customer response, add an internal
    note, update a ticket status, create a return request, or create a
    replacement request.
-   The agent must be able to review and, where appropriate, edit the
    draft response and proposed actions before execution.
-   Execution must use existing authorized backend/API/tool
    capabilities. Do not simulate success in the UI.
-   Validate permissions, record state, eligibility, and relevant data
    again immediately before consequential mutations.
-   Use idempotency or duplicate-action protection where
    supported/needed.
-   Require confirmation or additional authorization for high-impact
    actions. Payments, refunds, financial transfers, and other
    explicitly excluded/high-risk financial operations must not be
    autonomously executed by this feature.
-   If another agent has changed or resolved the task since analysis, do
    not blindly execute a stale plan. Explain the conflict and
    refresh/re-analyze.
-   If an action fails or only some actions succeed, report the exact
    outcome. Never claim the entire task completed if it did not.
-   Verify results using API responses or direct reads where
    appropriate. Prefer deterministic verification over another LLM
    call.
-   Keep an auditable record of proposed and executed actions in
    accordance with existing application/backend capabilities.

## 5. Token and API efficiency requirements

Cost-efficient, on-demand behavior is a first-class product requirement.

-   **No LLM call on initial page load** solely to produce the overview.
-   **No per-item AI analysis** for all visible tickets/orders/quotes.
-   **No bulk detail fetching** across unrelated records just in case
    they may be useful.
-   Fetch lightweight metadata first; fetch detailed data only for a
    selected task.
-   Keep tool calls scoped to the active task and the current
    user/tenant permissions.
-   Avoid sending large customer histories or entire records to the
    model when a relevant subset will do.
-   Reuse existing cached metadata where valid, but refresh data before
    executing mutations.
-   Do not make a second LLM call if a deterministic API call can verify
    execution.
-   Avoid repeated calls when the same required data is already
    available in the current task context and is still valid.
-   Track/inspect API calls and LLM invocations during testing so the
    team can confirm the lazy-loading behavior.
-   If an analysis cannot proceed without extra data, fetch only that
    missing data on demand.

## 6. Work prioritization

Initial task categories and display priority:

1.  **Tickets --- highest priority**
    -   Urgent/high-priority tickets
    -   Tickets nearing SLA breach
    -   New/unanswered customer requests
    -   Repeated complaints or escalations, if detectable from existing
        data
2.  **Orders --- second priority**
    -   Delayed shipments
    -   Return requests
    -   Replacement requests
    -   Cancellation requests
    -   Damaged/incorrect item issues
3.  **Quotes --- third priority**
    -   Quote inquiries
    -   Pending or expiring quotes
    -   Quote creation/modification requests
4.  **Secondary modules**
    -   Customer information lookup/update
    -   Cart/checkout investigation
    -   Product search/availability

Only display task categories and counts supported by existing data/API
capabilities. Clearly distinguish "count of records" from "items
requiring attention." Do not imply that all records have been analyzed.
A compact task card should explain why an item is surfaced when that
reason is known.

The first phase does not need sophisticated AI-based global
prioritization. Use existing priority/SLA fields and straightforward
rules, and keep the rules easy to understand and test.

## 7. Phased delivery plan

Deliver in working, testable phases. Do not try to implement the entire
long-term vision in one pass.

### Phase 1 --- Full-screen Agent Mode foundation

**Goal:** Build the new workspace and its lightweight, on-demand task
overview.

Scope: - Inspect only the Customer Success Studio and the direct
dependencies it uses. - Add navigation/entry point to a dedicated
full-screen Agent Mode route. - Reuse/adapt the existing AI assistant
chat on the left. - Build the minimal right-side priority/task
workspace. - Load lightweight task metadata only; no initial LLM
analysis. - Prioritize ticket tasks, then orders, then quotes. - Add
loading, empty, error, retry, and navigation states. - Selecting a task
opens its details using only the minimum necessary fetches. Full AI
resolution/execution workflows can be introduced in Phase 2. - Keep old
portal navigation and behavior intact. - Add tests proving the page does
not trigger bulk detail requests or LLM analysis on initial load.

Acceptance criteria: - Agent Mode opens as a full-screen page, not a
popover/drawer/overlay. - The existing portal remains available and
works. - The chat appears on the left and the compact priority workspace
on the right. - The initial view is visually minimal and not a dense
dashboard. - Initial load does not call the LLM to analyze every task. -
Initial load does not fetch full details for all
tickets/orders/quotes. - Task lists are permission-aware and
tenant-scoped. - No unrelated apps or monorepo areas were analyzed or
modified without a demonstrated dependency.

### Phase 2 --- Task investigation, prepared resolution, and execution

**Goal:** Demonstrate genuine end-to-end automation for the
highest-value use cases.

Implement in this order, depending on actual API support: 1. **Where Is
My Order (WISMO) ticket** - Analyze a selected ticket. - Find its
customer and relevant order. - Check current shipment status and
reliable ETA/reason data. - Draft an accurate customer response. -
Propose appropriate ticket note/status updates. - On approval, execute
supported actions and verify the results. 2. **Common ticket
resolution** - Investigate the selected ticket and relevant context. -
Prepare a response and a resolution plan. - Execute only supported,
authorized actions. 3. **Return request processing** - Check order/item
and return eligibility. - Prepare the return workflow and customer
instructions. - Execute the permitted return-request actions after
approval. 4. **Replacement request processing** - Check eligibility and
stock/availability where the system exposes it. - Prepare and execute a
supported replacement request after approval. 5. **SLA risk handling** -
Surface the relevant ticket using metadata/rules. - Analyze only when
selected and prepare a response/escalation action.

Shared requirements: - Clear investigation progress and relevant
evidence. - Structured plan with explicit proposed actions. -
Review/edit draft capability where appropriate. - Execute button and
real backend mutations. - Permissions and state validation immediately
before execution. - Duplicate/stale-plan protection, failure handling,
partial-success reporting, and auditability. - Automated tests for both
successful and unsuccessful flows.

Do not claim a use case is end-to-end complete if its necessary
API/action is missing. Identify the missing capability and implement it
only in the appropriate Studio/shared dependency/backend area when
necessary and approved by the existing architecture.

### Phase 3 --- Quote automation

**Goal:** Automate the most valuable quote workflows from Agent Mode.

Candidate use cases: - Quote status inquiry: inspect the selected quote
and prepare/send a grounded response. - Quote expiry follow-up: prepare
a reminder and log the interaction. - Quote creation assistance: extract
requested products/quantities, validate catalog data, and create a draft
quote where supported. - Quote modification: prepare a revision using
validated data and apply required approval rules.

Pricing, discounts, and commercial terms must come from authoritative
system data. Do not invent prices or autonomously bypass existing
approval requirements.

### Phase 4 --- Secondary modules and broader AI-first operations

Extend the same task-scoped pattern to: - Customer detail lookup and
permitted profile updates. - Cart/checkout troubleshooting. - Product
search and availability. - Additional supported order workflows, ticket
categories, and quote actions. - Conversational discovery and execution
of supported tasks from the chat, without forcing the agent to navigate
legacy screens.

Build on existing APIs and tools. Do not add tools or module
integrations just for breadth if no real supported action or use case
exists.

### Phase 5 --- Broader agent autonomy and production hardening

After the core workflows are proven: - Expand conversational workflows
for creating/searching orders and products, retrieving customer
information, and other authorized operations. - Add configurable
autonomy levels and policy controls where appropriate. - Improve audit
history, observability, latency/cost measurement, and safe recovery. -
Evaluate additional low-risk automation candidates using real usage
data. - Preserve explicit approval for sensitive or high-impact actions
and financial operations excluded from autonomous execution.

## 8. Initial use cases and test scenarios

### Use case A: Where Is My Order?

1.  A ticket appears in the lightweight task list.
2.  The agent selects Analyze.
3.  The system loads only the ticket and relevant
    order/shipment/customer data.
4.  AI prepares a response using verified status and ETA information.
5.  The agent reviews the response and proposed ticket updates.
6.  The agent clicks Execute.
7.  CustomerX sends/records the approved actions using existing
    authorized capabilities.
8.  The UI displays verified results.

Test: A delayed shipment must not be described as on time. If no
reliable ETA/reason exists, the AI must say the information is
unavailable and avoid inventing one.

### Use case B: Return request

1.  The agent selects a return-related ticket.
2.  The system loads the relevant order/item and applicable
    eligibility/policy data.
3.  AI prepares the return request and customer instructions.
4.  The agent reviews and executes.
5.  The system confirms the actual return request result.

Test: Ineligible or ambiguous returns must not be submitted
automatically. Financial refund processing must remain outside
autonomous execution.

### Use case C: Common ticket resolution

1.  The agent selects a ticket.
2.  AI retrieves only relevant records and tools.
3.  AI proposes the response and supported ticket updates.
4.  The agent approves and executes.
5.  The system verifies and reports the outcome.

Test: If a required action is unsupported, the AI must explain the
limitation rather than claim success.

### Cross-cutting tests

-   Initial page load makes zero LLM calls for task summarization.
-   Initial page load does not retrieve full details for every task.
-   Selecting one ticket only fetches relevant details.
-   Unauthorized users cannot access or execute another tenant's task.
-   Stale task state is detected before execution.
-   Duplicate execution is prevented where applicable.
-   API errors and partial failures are represented honestly.
-   Drafts are not sent before approval.
-   No financial/refund action is autonomously executed.
-   No unrelated app is modified as part of the implementation.

## 9. Implementation approach

Before coding: 1. Identify the Studio application root,
routing/navigation patterns, current assistant entry point, relevant API
clients, and test commands. 2. Inspect only files and shared
dependencies necessary for the above scope. 3. Summarize the current
architecture briefly and map each requirement to the existing
implementation. 4. Identify which ticket/order/quote APIs and actions
already exist. Do not assume an endpoint or capability exists without
verifying it. 5. Define the smallest end-to-end Phase 1 slice, then
implement it.

During implementation: - Follow existing code conventions, component
patterns, authentication, API/error handling, and styling. - Keep
changes focused and avoid unrelated refactors. - Prefer reuse over
duplicating chat/tool logic. - Keep the overview metadata-only and task
analysis on demand. - Add/update tests alongside implementation. - Run
the relevant Studio lint, type-check, test, and build commands available
in the repository. - Fix issues caused by the changes and report any
unrelated pre-existing failures separately.

## 10. Required completion report

At the end, provide: - Files changed and a concise description of each
change. - What works end-to-end now versus what is only scaffolded. -
APIs/tools reused and any missing backend capabilities. - Tests and
commands run, with actual pass/fail results. - Confirmation that initial
load performs no LLM analysis and avoids bulk detail fetching. - Any
security, permissions, stale-state, or execution limitations. - The next
smallest, testable step for the next phase.

**Do not stop after producing a design, plan, or mockup. Implement and
verify the current phase. Do not silently expand scope beyond Customer
Success Studio.**
