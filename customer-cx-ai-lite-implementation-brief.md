# Customer CX AI Lite --- Consolidation & Expandable Workspace Implementation Brief

## 1. Objective

Implement the next stage of **Customer CX AI Lite** in the Customer CX
Studio application.

AI Lite is currently a floating assistant opened from a corner button.
It should become the **single, context-aware entry point for the AI
capabilities available across Studio**, including relevant existing
page-level ticket and quote AI workflows.

This is a substantial implementation task. Begin by inspecting the
actual codebase, validating the assumptions in this brief, and producing
a concise implementation plan. Then implement in safe, testable phases.

### Core product expectations

1.  **One assistant, one conversation.** Compact and expanded modes must
    use the same AI Lite instance, conversation state, messages,
    generated results, and pending workflow state. Resizing must not
    start a new chat or duplicate requests.
2.  **Compact by default.** The corner popover remains useful for quick
    questions and short tasks.
3.  **Expandable workspace.** Add an expand/maximize control that opens
    AI Lite as a right-side panel occupying approximately 40--50% of the
    viewport while leaving the Studio page visible on the left.
4.  **Minimize back to compact mode.** The user can return to the small
    popover without losing the current conversation or analysis results.
5.  **Automatic expansion for complex workflows.** Workflows such as
    Analyze Ticket and Analyze Quote should open the expanded panel when
    the user explicitly starts them, because their results require room.
    Opening AI Lite by itself must not trigger an LLM call or
    automatically run an analysis.
6.  **Consolidate existing Studio AI capabilities into AI Lite.** Do not
    assume teammates' page-level AI features are already part of AI
    Lite. Inspect, preserve, and integrate the existing supported
    workflows rather than creating duplicate implementations.
7.  **Security first.** Every sensitive mutation must have explicit user
    approval and server-side authorization/safeguards.

## 2. Scope and boundaries

### In scope

-   `apps/studio` and the Studio runtime paths directly connected to AI
    Lite.
-   AI Lite UI, state, page context, compact/expanded presentation,
    contextual actions, result rendering, voice input, and form
    insertion.
-   Existing Studio proxy/API routes and direct AI backend routes
    required for the supported workflows.
-   Direct dependencies and integrations needed by Studio, including
    `apps/ai-assist`, `@csa/ui`, `@csa/headers`, and relevant API proxy
    routes.
-   Tests, permissions, tenant isolation, error states, and
    documentation for the changes.

### Out of scope

-   Do not investigate or modify unrelated applications or products (for
    example, marketing sites or RepMotion).
-   Do not introduce a code-review feature. This is an
    e-commerce/customer-service platform; code review is not a
    requirement.
-   Do not replace working backend workflows merely to make the UI look
    unified.
-   Do not add new providers, frameworks, or UI libraries unless the
    existing repository architecture requires them and the need is
    explained.

## 3. Required first step: inspect before editing

Inspect the current repository and confirm the current implementation,
actual file paths, and behavior. Treat file names below as known
starting points from prior discovery, not as a substitute for code
inspection.

Starting points previously identified:

-   AI Lite global mounting: `AppShell.tsx` (previously observed near
    the AI Lite mount).
-   Page context: `page-context.tsx` and `useRegisterPageContext` usage.
-   AI Lite component: `CustomerCxAiLite.tsx`.
-   Full-page assistant: `/csa-assistant`.
-   Studio streaming proxy: `/api/chat/stream`.
-   AI backend chat route: `apps/ai-assist/src/routes/chat.ts`.
-   Ticket AI Review and Quick Review: `TicketAIReview.tsx`,
    `TicketAIQuickReview.tsx`.
-   Ticket review proxy/backend: `/api/tickets/ai-review` and
    `apps/ai-assist/src/routes/ticket-review.ts`.
-   Quote AI Review and Quick Review: `QuoteAIReview.tsx`,
    `QuoteAIQuickReview.tsx`.
-   Quote review proxy/backend: `/api/quotes/ai-review` and the
    corresponding quote-review route.
-   Voice support: `use-voice-chat.ts` and `ChatStream.tsx`.
-   An orphaned prototype `TicketAIHelper.tsx` was previously reported
    as mock-driven; verify before deciding whether it can be retired.

Before implementation, report: 1. The verified current architecture and
relevant entry points. 2. Which existing page-level AI workflows are
real and in use. 3. Which capabilities AI Lite already supports versus
those it lacks. 4. Any discrepancies from this brief. 5. A phased plan
and files expected to change.

Do not stop at an architecture report: after the inspection and plan,
proceed with implementation unless a real blocker requires a decision.

## 4. Expandable AI Lite workspace

### 4.1 Layout and interaction

Implement two presentation modes backed by the same mounted/logical
assistant instance:

-   **Compact mode:** existing floating corner popover.
-   **Expanded mode:** right-side panel/drawer with a target width of
    roughly 40--50% of the available viewport on desktop. Keep the
    Studio page visible and usable on the remaining side where
    practical.

Use existing Studio and `@csa/ui` design patterns. Avoid introducing a
separate design system or a second chat implementation.

The expanded header should include: - AI Lite identity/title. - A
minimize/restore control. - A close control, consistent with current
application behavior. - Optional current page/entity context when
useful.

The panel body should give complex results enough width and vertical
room for: - Ticket or quote summary and findings. - Recommended next
action(s). - Draft email/customer reply. - Relevant linked
order/customer context. - Action buttons, approval steps, loading
states, and errors. - The normal chat composer and conversation history.

### 4.2 State preservation

Switching between compact and expanded modes must preserve: -
Conversation messages and history. - Current page/entity context. -
In-progress analysis and its results. - Draft text and user edits. -
Pending confirmation/approval state. - Tool results and action state. -
Voice input state where technically safe; if an active recording cannot
survive a mode transition, handle it gracefully and visibly.

Do not remount/reset the chat merely to change its size. Prefer a single
component/state owner with layout variants or a shared state container.
Avoid duplicated subscriptions, event handlers, streaming requests, or
effects.

Closing and reopening should follow the current session persistence
contract. Inspect current behavior and preserve it unless there is a
clear, documented reason to change it. At minimum, minimize/expand must
never discard the session.

### 4.3 Responsive behavior and accessibility

-   On desktop, use the side-by-side panel described above.
-   On narrow viewports, use a near-full-screen panel or another
    responsive layout that remains usable.
-   Keep controls keyboard-accessible with accessible labels and focus
    states.
-   Ensure the panel has sensible scrolling: conversation/result content
    scrolls independently from the fixed header and composer.
-   Avoid covering important page controls unnecessarily.
-   Respect existing focus, escape-key, and modal/drawer conventions in
    Studio.
-   Avoid layout shifts in the underlying page unless the existing shell
    architecture makes them necessary.

### 4.4 Automatic expansion rules

Expand only when the user explicitly starts a complex workflow, for
example: - Analyze Ticket / Ticket AI Review. - Analyze Quote / Quote AI
Review. - Another existing workflow confirmed during inspection to
produce substantial structured output.

Do **not** expand simply because: - The user opens AI Lite. - The user
navigates to a ticket, quote, order, or customer page. - Page context is
registered or updated. - A context resolver fetches deterministic data.

Do not automatically invoke an LLM when opening the popover or switching
pages. Automatic expansion is a UI behavior after explicit user intent,
not permission to run an analysis without that intent.

## 5. Consolidate existing AI capabilities into AI Lite

AI Lite should become the single user-facing workspace, while
appropriate specialized backend routes may remain separate. Reuse the
existing implementation and security boundaries wherever possible.

### 5.1 Ticket AI Review and Quick Review

Existing page-level ticket review reportedly supports: - Ticket
intent/issue analysis. - Customer message and linked-order context. -
Potential phone/contact update proposals. - Order issue detection. -
Customer response drafting. - Worklog-note suggestions. - Findings and
recommended next steps.

Requirements: 1. Move the user-facing entry point and rendered results
into AI Lite. 2. Provide a contextual **Analyze Ticket** action on
ticket details; provide appropriate batch/quick review entry points on
ticket lists only if the existing workflow supports them safely. 3.
Trigger analysis only after an explicit user action. 4. Open the
expanded AI Lite panel when analysis starts. 5. Show a readable summary,
findings, recommended next steps, proposed updates, and reply/worklog
drafts using structured UI components rather than one dense text blob.
6. Allow the user to edit a draft before inserting it into the
corresponding reply/worklog form. 7. Preserve any useful existing review
logic and route rather than duplicating prompts or business rules. 8.
Keep proposed updates distinct from executed changes. Do not silently
apply changes suggested by AI.

**Critical cost fix:** a previous inspection reported that
`TicketAIReview.tsx` defaults to `initialOperation = "analyze"` and may
automatically call `/api/tickets/ai-review` on mount. Verify this. If
still true, remove the automatic analysis-on-mount behavior. Mounting
the component, opening AI Lite, or navigating to a ticket must not cause
an analysis request unless the user explicitly clicks the action.

### 5.2 B2B Quote AI Review and Quick Review

Existing quote review reportedly provides: -
Accept/reject/needs-more-information recommendation. - Findings and
reasoning. - Suggested next steps. - Draft reply to the buyer.

Requirements: 1. Bring the workflow and its results into AI Lite. 2. Add
**Analyze Quote** where appropriate on quote detail/list pages. 3.
Register quote page context using the existing page-context pattern if
it is not already registered. 4. Expand AI Lite only when the user
starts the analysis. 5. Render the recommendation, findings, and
editable buyer reply in a spacious, structured layout. 6. Keep
recommendations separate from actual quote acceptance/rejection or other
business mutations. Never execute a decision merely because the model
recommends it. 7. Reuse the existing quote-review backend workflow and
its authorization boundary.

### 5.3 Voice dictation and voice mode

Previously identified voice functionality lives in `use-voice-chat.ts`
and `ChatStream.tsx` on the full-page assistant and uses the browser Web
Speech API.

Inspect the actual behavior and determine which parts can safely be
reused in AI Lite. Bring voice input/dictation into AI Lite where
browser support allows: - Provide an obvious microphone control in the
composer. - Show permission, listening, transcript, unsupported-browser,
and error states. - Let the user review/edit the transcript before
sending unless the existing product behavior explicitly requires
otherwise. - Do not send audio/transcript to the model automatically
without the user action expected by the current UX. - Avoid duplicate
microphone sessions and clean up listeners on unmount. - Do not promise
universal browser support.

If full continuous voice conversation is substantially different from
dictation, implement the smallest reliable and consistent scope first
and document any deferral.

### 5.4 Tool result and generative UI support

The previous discovery reported that AI Lite can render several
structured commerce/customer-service results but may be missing: -
`ticket_card`. - `crm_contact_card`. - `useChatToolEffects` or
equivalent tool-result side-effect handling.

Verify these gaps against current code and the tool schema. Add missing
renderers/effects only where they are part of existing supported
assistant capabilities. Ensure: - Tool results render in AI Lite and
remain readable in both sizes. - Loading, error, empty, and retry states
are handled. - Tool effects cannot bypass permission checks or
confirmation requirements. - Existing card/action conventions are
reused. - Unknown tool outputs fail gracefully instead of crashing the
conversation.

Do not create a second source of truth for tool definitions or duplicate
existing business logic.

### 5.5 Contextual actions

Offer useful actions based on the active Studio page and current entity.
Keep the set focused and only expose actions supported by existing
APIs/tools and current permissions.

Potential examples to validate during inspection:

-   **Ticket detail:** Analyze Ticket, Draft Reply, Check Linked Order,
    Suggest Worklog Note.
-   **Order detail:** Explain Status, Check Return Eligibility, Create
    Ticket, Reorder Items (subject to existing safeguards).
-   **Customer detail:** Summarize Account, Recent Orders, Find Open
    Tickets, Check CRM.
-   **Quote detail:** Analyze Quote, Verify Stock, Draft Buyer Reply.
-   **List pages:** Summarize Visible Page, Filter Urgent, Find
    Unassigned Records, only if the data and operations are available.
-   **General:** Look Up Order, Find Customer, Create Ticket.

Requirements: - Derive available actions from trusted page context and
permissions. - Do not expose actions just because the model suggests
them. - Do not fabricate records or claim a tool succeeded when it did
not. - Do not automatically fetch or summarize large datasets merely
because the panel opened. - Keep context changes synchronized between
compact and expanded views. - If the page has no registered context,
show useful general assistant functionality without inventing an entity
context.

### 5.6 Draft insertion into existing forms

For reply and worklog workflows: - Provide an explicit **Insert into
reply** / **Insert into worklog** action when the matching form is
present. - Let users review and edit generated text before insertion. -
Insert into the correct active field without submitting the form. -
Never send a reply, save a worklog, or submit a business form
automatically. - Handle the target form being absent, hidden, or stale
with a clear message and safe fallback (for example, Copy). - Avoid
overwriting user-entered text silently. If the target is non-empty,
append/replace only after a clear user choice. - Preserve the draft in
AI Lite if insertion fails.

### 5.7 Prototype cleanup

Inspect `TicketAIHelper.tsx` and other candidate components before
removing anything. A previous discovery described `TicketAIHelper.tsx`
as an orphaned mock-driven prototype and said the existing
`create_ticket` tool supersedes it. If confirmed unused and redundant: -
Do not integrate the mock prototype. - Remove it only if it is truly
unreferenced and cleanup is safe. - Prefer the production workflow and
existing `create_ticket` capability. - Record the cleanup in the
implementation summary.

## 6. Architecture and request flow

Keep one user-facing AI Lite interface, but do not force all workflows
through one backend endpoint if specialized endpoints are appropriate.

Expected shape: - AI Lite compact/expanded UI and shared session state
in Studio. - Trusted page context registered through the existing
context mechanism. - General chat/tool requests through the existing
chat streaming proxy. - Ticket review through the existing authenticated
Studio proxy and ticket-review backend. - Quote review through the
existing authenticated Studio proxy and quote-review backend. - Voice
dictation through supported browser APIs and the same AI Lite
composer/session. - Structured results displayed within the same AI Lite
conversation/workspace.

Use the existing project patterns for authentication, headers,
streaming, error handling, and tenant scoping. Do not call internal
backend services directly from the browser if the established Studio
proxy is the security boundary.

A deterministic context lookup such as `/api/context/resolve` may be
used when needed, provided it remains deterministic and does not trigger
an LLM call. Confirm the actual route and behavior before relying on
this assumption.

## 7. Security, authorization, and approval gates

This section is mandatory, not optional.

### 7.1 Preserve trust boundaries

Previously observed proxy patterns reportedly call `getCurrentUser()`,
strip untrusted role/project/ACL fields, and inject trusted `x-csa-*`
headers. Verify the current implementation and preserve its
trusted-header/authentication model.

-   Authenticate and authorize every request server-side.
-   Enforce tenant and project isolation at the server/backend boundary.
-   Never trust client-supplied roles, project IDs, tenant IDs, or ACLs
    without server-side validation.
-   Reuse established secure Studio proxies and authorization utilities.
-   Avoid leaking secrets, credentials, tokens, or sensitive customer
    data into logs.

### 7.2 Sensitive mutations require explicit approval

Any sensitive or destructive action---including, but not limited to,
placing/cancelling orders, issuing refunds, changing customer/order
details, or accepting/rejecting quotes---must have: 1. An explicit,
clear user confirmation immediately before execution. 2. Server-side
authorization and tenant/project validation. 3. A server-enforced
approval/confirmation mechanism where supported by the architecture. 4.
Validation of the target record and requested operation at execution
time. 5. Safe handling of stale data, retries, duplicate requests, and
partial failures. 6. A clear result only after the backend confirms
success.

A model-generated suggestion is not approval. A UI button alone is not
sufficient if the server does not enforce the required
authorization/approval boundary.

A previous review flagged `cancel_order` and `place_order` as possible
gaps around approval tokens or optimistic/version checks. Verify these
tools and related mutation paths. Fix the gap before enabling or
expanding the relevant actions. Apply the same review to refund and
other sensitive mutation tools.

Read-only analysis can run after explicit user intent without a mutation
approval, but must still respect access control and data minimization.

## 8. Token cost, latency, and request behavior

-   Opening AI Lite must not trigger an LLM request.
-   Expanding/minimizing must not trigger a new LLM request.
-   Registering/updating page context must not trigger an LLM request.
-   Navigating between pages must not trigger analysis just because the
    current entity changed.
-   Only run ticket/quote analysis after the user explicitly starts it.
-   Avoid duplicate analysis calls caused by React remounts, Strict
    Mode, effects, or repeated clicks.
-   Use loading/disabled states to prevent accidental duplicate
    submissions.
-   Keep deterministic context resolution separate from model inference.
-   Avoid unnecessary repeated tool calls and large context payloads.
-   Where safe, reuse current results while the entity and relevant
    source data remain unchanged; invalidate them when context changes
    so stale findings are not shown as current.

## 9. UX and visual requirements

-   Follow existing Studio visual language and `@csa/ui` components.
-   Keep the compact popover compact; do not cram complex results into
    it.
-   Use the expanded panel for dense structured content and longer
    drafts.
-   Use clear headings, readable spacing, and responsive layouts.
-   Make ticket/quote results scannable: summary, findings, recommended
    action, draft, and explicit available actions.
-   Clearly distinguish AI recommendations, proposed changes, pending
    approvals, and completed actions.
-   Show which ticket/quote/order/customer the result refers to.
-   Show useful loading, empty, error, retry, and permission-denied
    states.
-   Avoid false success messaging.
-   Keep the page and conversation context obvious.
-   Provide an accessible title/label for expand, minimize, close,
    microphone, and action controls.

## 10. Suggested implementation phases

### Phase 1 --- Audit and safety foundation

-   Verify current architecture and AI Lite mounting/state.
-   Identify and inventory supported page-level AI features within
    Studio and direct dependencies.
-   Remove any ticket auto-analysis-on-mount behavior if confirmed.
-   Establish tests proving that opening, expanding, minimizing, and
    navigating do not trigger unintended LLM calls.
-   Audit sensitive mutation approval and server-side authorization
    gaps.

### Phase 2 --- Shared expandable workspace

-   Add compact/expanded presentation state without duplicating the
    chat.
-   Implement responsive right-side panel, controls, scroll behavior,
    and state preservation.
-   Verify streaming, draft editing, pending confirmation, and context
    remain intact across mode switches.
-   Add automatic expansion only for explicitly started complex
    workflows.

### Phase 3 --- Ticket and quote workflows

-   Integrate existing ticket review and quote review into AI Lite.
-   Add quote page-context registration if missing.
-   Render structured analysis results in the expanded panel.
-   Add edit/copy/insert interactions for replies and worklog drafts.
-   Keep all final business decisions and mutations explicit and
    protected.

### Phase 4 --- Tool results, contextual actions, and voice

-   Add any verified missing result renderers/tool effects.
-   Add page- and permission-aware contextual actions.
-   Integrate voice dictation with browser capability and error
    handling.
-   Validate all supported flows use the same AI Lite session.

### Phase 5 --- Hardening, testing, and cleanup

-   Run relevant unit, integration, type, lint, and build checks.
-   Add/update end-to-end coverage for the core interactions.
-   Test keyboard access, narrow viewport behavior, loading/errors,
    permission denials, and session preservation.
-   Remove only verified orphaned prototypes.
-   Update documentation and provide a final implementation report.

Adjust the phase order if the repository reveals dependencies, but
explain why before diverging materially.

## 11. Acceptance criteria

### Shared conversation and resizing

-   [ ] AI Lite opens in compact mode by default.
-   [ ] An expand control opens the right-side workspace at the agreed
    approximate width.
-   [ ] A minimize control returns to compact mode.
-   [ ] Both modes show the same conversation and analysis results.
-   [ ] Resizing does not remount/reset the logical chat session or
    duplicate requests.
-   [ ] Drafts, pending confirmations, and current context survive mode
    changes.
-   [ ] Narrow screens remain usable.

### No unintended model usage

-   [ ] Opening AI Lite causes zero LLM calls.
-   [ ] Expanding/minimizing causes zero LLM calls.
-   [ ] Page-context registration/navigation causes zero LLM calls by
    itself.
-   [ ] Ticket/quote analysis runs only after an explicit user action.
-   [ ] No duplicate calls occur due to remounts or repeated clicks.

### Ticket and quote workflows

-   [ ] Ticket review results are available inside AI Lite.
-   [ ] Quote review results are available inside AI Lite.
-   [ ] Complex analysis explicitly expands the panel.
-   [ ] Findings, recommendations, and drafts are structured and
    readable.
-   [ ] AI suggestions do not silently mutate records.
-   [ ] Reply/worklog drafts can be reviewed and inserted without
    submitting the form.
-   [ ] Missing or stale forms have safe fallback behavior.

### Context, tools, and voice

-   [ ] Contextual actions reflect the active entity/page and
    permissions.
-   [ ] Verified existing tool outputs render without crashing.
-   [ ] Voice dictation has clear support, permission, and error states.
-   [ ] Compact and expanded modes use the same AI Lite session.
-   [ ] Unsupported or unauthorized actions are hidden or safely
    rejected server-side.

### Security and quality

-   [ ] Tenant/project isolation and trusted identity headers remain
    enforced.
-   [ ] Sensitive mutations require explicit approval and server-side
    safeguards.
-   [ ] Stale data, retries, and duplicate mutation attempts are handled
    safely.
-   [ ] No secrets or unnecessary sensitive data are logged.
-   [ ] Relevant tests, type checks, lint, and build checks pass, or
    failures are explicitly documented.

## 12. Required testing scenarios

At minimum, verify these scenarios:

1.  Open AI Lite on a normal page; confirm no LLM request occurs.
2.  Type a short question, receive a response, expand, and confirm the
    same conversation remains.
3.  Minimize and re-expand during/after a response; confirm no duplicate
    stream or lost content.
4.  Open a ticket page; confirm no automatic ticket analysis.
5.  Click Analyze Ticket; confirm one analysis request, panel expansion,
    and readable results.
6.  Edit a generated reply and insert it into a reply form; confirm the
    form is not submitted.
7.  Try insertion with a non-empty form; confirm existing text is not
    silently overwritten.
8.  Analyze a quote; confirm recommendation and buyer reply appear in AI
    Lite and no quote decision is executed.
9.  Navigate to another entity; confirm stale analysis is not presented
    as current.
10. Test voice input in a supported browser and verify permission
    denial/unsupported-browser states.
11. Attempt a sensitive mutation as an unauthorized user and verify
    server-side rejection.
12. Confirm a sensitive mutation cannot execute without the required
    approval, even if a request is forged outside the UI.
13. Test a narrow viewport and keyboard navigation.
14. Verify retries and repeated clicks do not create duplicate analyses
    or mutations.

## 13. Definition of done and final report

Do not report completion based only on code changes. Provide a concise
final report containing:

-   Verified architecture and actual files changed.
-   Features integrated and how users access them.
-   How compact/expanded mode shares state.
-   Which workflows auto-expand and why.
-   How unintended LLM calls were prevented.
-   Security/approval safeguards implemented and any remaining gaps.
-   Tests, type checks, lint, and build results.
-   Known limitations or deferred items.
-   Any assumptions or discrepancies discovered during implementation.

If a security-critical gap remains, clearly mark it as a blocker and do
not claim the corresponding mutation flow is production-ready.

## 14. Working instructions for the implementer

-   Work only within Customer CX Studio and its direct
    runtime/API/backend dependencies described above.
-   Inspect current code before editing; do not assume file paths or
    earlier findings are still exact.
-   Reuse existing components, routes, prompts, schemas, tool
    definitions, and authorization utilities where possible.
-   Avoid broad refactors unrelated to this objective.
-   Keep changes incremental and test after each phase.
-   Do not replace production functionality with mock data.
-   Do not silently weaken permissions or remove approval requirements
    to make a demo work.
-   Do not implement code review.
-   If a requirement cannot be implemented safely with the current
    architecture, explain the blocker and propose the smallest safe
    alternative.
