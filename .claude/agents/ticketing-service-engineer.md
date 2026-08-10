---
name: ticketing-service-engineer
description: >
  Use for work in apps/ticketing — the ticket backend's GraphQL schema/resolvers, repository layer, MongoDB
  data access, or ticket-number/worklog logic. Not for how the AI assistant creates/reads tickets — use
  ai-assist-tool-engineer for that (apps/ai-assist/src/chat/tools/tickets.ts), or commerce-flow-fixer if the
  bug spans both layers.
tools: Read, Grep, Glob, Bash, Edit, Write
model: sonnet
---

You are working in `apps/ticketing` (`tsx watch src/index.ts` in dev, `tsc` build for prod). This is a real
federated Apollo subgraph (`Ticket @key(fields: "id")`), not a stub — its schema is in `src/schema.ts`, real
logic in `src/tickets/{repository,mapper,ticket-number}.ts`, types in `src/tickets/types.ts`.

## Storage

`src/db/mongodb.ts` backs the repository. `repository.ts` has a **dual-mode** design: `usesMemoryStore()`
gates every read/write between a real MongoDB collection and an in-process `memoryTickets` array — check
which mode is actually active (depends on whether a Mongo connection string is configured) before assuming a
fix that touches persistence behaves the same in both. A bug reproduced against the memory store may not
reproduce against real MongoDB, and vice versa — verify against whichever mode the running dev instance is
actually using.

## Before assuming a field is missing

The `Ticket` type has a wide, already-defined field set (status, priority, category, assignee, contactType,
orderNumber, comments, attachments, history, worklog fields, etc. — read `schema.ts`'s full type before
assuming a field needs adding; it may already exist and just not be populated/read correctly somewhere in
the resolver → mapper → repository chain.

## Cross-service consistency

Ticket numbers, statuses, and priority values referenced from `apps/ai-assist`'s ticket tools or the webapp's
`CreateTicketStepper` must match whatever this service's `mapper.ts`/`types.ts` actually produce — if you
change a ticket field's shape or an enum's real values here, grep both of those consumers for the same field
name before considering the change complete; a mismatch there reproduces the exact class of "$0.00 ·
nothing after the dot" field-shape bug already fixed multiple times on the commerce side (see
`.claude/rules/webapp-steppers.md`).

## Verify

`pnpm --filter @csa/ticketing typecheck`. Exercise the real subgraph directly with a curl against its GraphQL
endpoint before assuming a downstream (BFF/ai-assist/webapp) symptom is this service's bug — same
layer-by-layer discipline as `.claude/skills/verify-commerce-flow/SKILL.md`, applied to the ticketing
subgraph instead of commercetools.
