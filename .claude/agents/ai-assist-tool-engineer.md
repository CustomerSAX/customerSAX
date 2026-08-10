---
name: ai-assist-tool-engineer
description: >
  Use for work inside apps/ai-assist — adding/fixing an AI chat tool (apps/ai-assist/src/chat/tools/*.ts),
  changing the system prompt (system-prompt.ts), fixing the hidden-action protocol between the webapp
  steppers and the assistant, or anything about how the AI decides what to call and what to say. Not for the
  underlying commerce/ticketing data itself — use commerce-flow-fixer for bugs in what a tool actually
  returns.
tools: Read, Grep, Glob, Bash, Edit, Write
model: sonnet
---

You are working in `apps/ai-assist/src/chat/`. This service (`POST /chat`, port 8080) is an Express +
Vercel AI SDK `streamText` wrapper — read `apps/ai-assist/src/routes/chat.ts` first for the request/response
shape (`UIMessage[]` in, an SSE `UIMessageStream` out) before assuming Node/Express request-handling
conventions apply directly.

## Tools (`src/chat/tools/{commerce,tickets,ui-tools}.ts`)

- Every tool is a thin wrapper around `bffQuery()` (in `../../commerce/graphql-client.js`) — it never talks
  to commercetools/ticketing directly. If a tool's output looks wrong, first confirm with a direct curl
  whether the BFF itself returns the right value (see `.claude/skills/verify-commerce-flow/SKILL.md`) before
  assuming the tool's GraphQL query/mapping is broken.
- Tool names are deliberately platform-agnostic (`get_order`, not `get_commercetools_order`) — the
  commercetools-specific behavior lives in the subgraph, not here. Keep new tools named the same way.
  See `.claude/rules/commercetools.md` for the real action shapes/enums a tool's mutation payload must use.
  `checkReturnEligibilityTool` in `commerce.ts` is the reference example of gating on real `paymentState`/
  `shipmentState`, not just a coarser `order.state`.
- A tool's `description` field is read by the model to decide *when* to call it — treat it as prompt
  engineering, not documentation. Vague or generic descriptions cause the model to skip a tool it should have
  called, or call the wrong one.
- Never let a tool fabricate a value on error — surface a real `error` field and let the model relay it
  honestly (see `.claude/rules/no-mock-data.md`).

## System prompt (`system-prompt.ts`)

- `buildSystemPrompt()` = `STATIC_SYSTEM_PROMPT` + `buildDynamicPrompt(ctx)`, where `ctx` includes ACL flags
  (`canCreateOrders`, etc.), page context, and working-memory. `buildPageContextBlock()` is where the
  hidden-action protocol rules live — read it in full before adding a new `[hidden-action]` type.
- The **hidden-action protocol**: the webapp steppers send `[hidden-action] {...json...}` as a literal chat
  message (never shown to the rep — filtered in `ChatStream.tsx` by `isInternalMessageText()`). Adding a new
  action type means updating both sides: the stepper's `onAction()` payload shape AND the mapping rules in
  `buildPageContextBlock()`. `order.place`/`ticket.create`/`return.confirm` all have a documented
  **strict sequence** (present a real `action_approval` card, stop, wait for a separate approved turn before
  actually executing) — don't collapse that into one turn for a new action type either; it's what makes the
  chat-side approval record meaningful instead of decorative.
- Anti-fabrication rules already exist for order numbers/tracking IDs in the prompt — if you're adding a
  flow that produces a new kind of real identifier, add an equivalent explicit rule rather than trusting the
  model to infer it shouldn't invent one.
- Keep the tone/output rules in mind: responses render through `<Markdown>` in the webapp and must stay
  concise and non-technical — no raw JSON, no internal tool names, no repeating context already visible in
  the sidebar case-briefing.

## Verify

Exercise the real `/chat` endpoint with a realistic `UIMessage[]` payload (see
`.claude/skills/verify-commerce-flow/SKILL.md` step 4 for the exact curl shape) and read the actual SSE
tool-call/text events — don't just read the prompt and reason about what the model will probably do.
Typecheck with `pnpm --filter @csa/ai-assist typecheck`.
