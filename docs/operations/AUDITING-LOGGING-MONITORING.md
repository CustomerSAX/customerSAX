# Auditing, Logging, and Monitoring in customerSAX

| Document status | Code-verified current state |
|---|---|
| Audience | Engineering, SRE/Operations, Security, Support, and Product |
| Scope | Studio, BFF, AI Assist, Admin, Ticketing, and commerce services |
| Last verified | 17 September 2026 |
| Source of truth | Current repository implementation; future-state items are explicitly labelled |

## 1. Purpose

customerSAX uses three related but different operational controls:

| Control | Question it answers | Current system of record |
|---|---|---|
| **Audit trail** | Who changed a business or administrative object, what did they change, and when? | MongoDB `csa-admin.csa_audit_log` for successful Admin GraphQL mutations |
| **Application logging** | What happened while a request was processed, and why did it fail? | Structured process output; Cloud Run output is collected by Google Cloud Logging |
| **Monitoring** | Is the platform available and healthy, and are its operational signals outside expected ranges? | Service health endpoints, Studio health display, Cloud Run platform telemetry, Cloud Logging, and deployment status |

These controls must not be treated as interchangeable. Application logs are diagnostic and may be sampled or retained according to platform policy. Audit records are business/security evidence and need an explicit schema, access policy, retention policy, and tamper-resistance appropriate to that role.

## 2. High-level flow

```text
Browser / Studio
    |
    | x-request-id and authenticated CSA context
    v
Studio API route -> BFF -> subgraph / AI Assist -> downstream provider
    |                |             |
    +----------------+-------------+
                     |
                     +--> structured operational logs
                          service, module, requestId, tenant context,
                          route/operation, status, duration, error trace

Successful Admin mutation
    |
    +--> MongoDB csa-admin.csa_audit_log
         actor, action, clientId, projectKey, target, createdAt

Health endpoints / platform telemetry
    |
    +--> Studio Core Service Health and Google Cloud operations tooling
```

The `x-request-id` is the main link across operational logs. It is accepted from the inbound request or generated at the edge, forwarded to downstream services, and added to log context. Audit documents do **not** currently include the request ID, so direct audit-to-log correlation is not yet available.

## 3. Auditing

### 3.1 What is audited today

The Admin service wraps every GraphQL resolver whose field name begins with `admin`. After a successful `admin*` mutation returns, it writes one document to the audit collection.

The stored document currently contains:

| Field | Meaning |
|---|---|
| `actor` | User email from the trusted request context, or `unknown` when unavailable |
| `action` | GraphQL mutation field name, for example `adminUpdateRole` |
| `clientId` | Organisation/tenant identifier when present |
| `projectKey` | Project identifier when present |
| `target` | First available value from `id`, `email`, or `projectKey` mutation arguments |
| `createdAt` | Server-side MongoDB insertion time |

The collection location is configurable:

- Database: `MONGO_ADMIN_DB`, default `csa-admin`
- Collection: `MONGO_AUDIT_COLLECTION`, default `csa_audit_log`

The audit write occurs **after** the mutation succeeds. It is deliberately best-effort: if the business mutation has already committed and the audit insert fails, the response remains successful and an `admin audit write failed (mutation already committed)` error is emitted to the operational log.

### 3.2 What is not audited today

The current persisted audit trail does not cover:

- Admin reads or denied Admin operations
- Customer, order, cart, product, ticket, refund, return, or payment actions outside Admin mutations
- AI approvals, guardrail decisions, prompts, or full AI action outcomes as audit records
- Authentication events such as login, logout, or failed access attempts
- Before/after field values, reason codes, source IP, user agent, session ID, or request ID
- Audit record updates/deletes, immutability controls, retention/archival, or integrity verification
- A repository-backed query/API for displaying the persisted audit records

### 3.3 Studio Audit Log page caveat

The Studio route at `/admin/audit-log` currently displays browser-generated demonstration entries from `generateAuditLogEntries()`. Its filters and expanded detail view operate on those in-memory entries. It does **not** query `csa_audit_log`.

This means the page must not currently be used as compliance evidence or as proof that a specific production action occurred. The persisted Admin mutation records can only be examined through authorised database/operational access until a secured, tenant-scoped audit query is implemented.

### 3.4 Recommended production audit contract

The following is a target design, not the current stored schema:

```json
{
  "eventId": "immutable unique identifier",
  "occurredAt": "UTC timestamp",
  "requestId": "cross-service correlation identifier",
  "tenant": { "clientId": "...", "projectKey": "..." },
  "actor": { "id": "...", "type": "user|ai|system", "role": "..." },
  "action": "order.cancel",
  "resource": { "type": "order", "id": "..." },
  "outcome": "success|denied|failed",
  "reasonCode": "policy or business reason",
  "approval": { "required": true, "approvedBy": "...", "approvedAt": "..." },
  "changes": [{ "field": "status", "before": "Open", "after": "Cancelled" }],
  "source": { "service": "...", "channel": "studio|ai-assist|system" },
  "schemaVersion": 1
}
```

Sensitive customer content, credentials, access tokens, and payment data must never be copied into audit records. Field-level changes should be allowlisted, with sensitive values redacted or represented by a non-reversible indicator.

## 4. Application logging

### 4.1 Shared structured logger

Backend services use `@csa/logger`, a Winston-backed logging facade. Each record includes a log level, timestamp, service name, message, and optional structured metadata.

- Production (`NODE_ENV=production`): one JSON object per output line
- Development: colourised, human-readable single-line output
- Minimum level: `LOG_LEVEL`, default `info`
- Supported levels: `debug`, `info`, `warn`, and `error`
- Child loggers attach stable fields such as `module`
- Errors are normalised to `name`, `message`, and `stack`
- `safeStringify` handles circular values and bigints and truncates output at approximately 8,000 characters

Studio uses the dependency-free `@csa/logger/client` shim. Its production output is structured JSON written through the runtime console; it does not use Winston or server-side async context.

### 4.2 Request correlation

`@csa/logger` stores request context in Node.js `AsyncLocalStorage`. Depending on the server type, a shared edge helper:

1. Reads `x-request-id`, or creates a UUID when it is absent.
2. Seeds the request context.
3. Echoes or forwards the request ID to the next hop.
4. Adds the context to logs produced deeper in the same async request chain.
5. Emits a request/GraphQL completion log with elapsed time.

The context can include:

- `requestId`
- `projectKey` and `clientId`
- `userRole`
- HTTP `method` and `path`
- GraphQL `operationName` on the completion record

`userEmail` is available to application code for identity resolution but is intentionally removed from the logger's automatically merged context.

The server integrations are:

| Runtime | Integration | Access log behaviour |
|---|---|---|
| Raw Node HTTP (Auth) | `withHttpContext` | Logs method, path, status, and `durationMs` when the response finishes |
| Express (AI Assist) | `expressContext` | Logs method, path, status, and `durationMs` when the response finishes |
| Apollo (BFF and subgraphs) | `apolloContext` + `apolloLoggingPlugin` | Logs GraphQL operation name and `durationMs` |
| Studio server API routes | `requestLogger` + `forwardRequestId` | Adds `service=studio`, route module, and request ID; individual routes log relevant outcomes |

### 4.3 AI tool execution logging

AI Assist wraps registered tool executions with structured traces. It records:

- Tool name
- Argument **keys**, never argument values
- Duration in milliseconds
- Success/error outcome
- Normalised thrown errors

The active request and tenant context is attached automatically. These records are operational traces; they are not persisted as governed audit events.

### 4.4 Data protection rules

The shared package provides two PII-safety helpers:

- `describe(value)` records only a type and optional size.
- `safeMeta(meta)` keeps allowlisted operational fields and identifier/count/duration/status-shaped fields while dropping other values.

Explicitly denied metadata includes email, recipients, passwords, secrets, tokens, authorisation headers, addresses, request bodies, HTML, free-form content, plaintext, and ciphertext.

These helpers are available but are not automatically applied to every metadata object passed to the logger. Call sites are still responsible for using safe fields. Stable technical identifiers can also be sensitive in some contexts, so access to logs must remain restricted.

### 4.5 Log destinations

- Local development: service process output in the terminal.
- Cloud Run services: JSON written to stdout/stderr and collected by Google Cloud Logging.
- Cloud Build: configured with `CLOUD_LOGGING_ONLY`.
- Studio/Vercel: console output is retained and searched through the configured hosting runtime; it is not automatically unified with the Cloud Run log stream by this repository.

No OpenTelemetry tracing exporter, central error tracker, or dedicated log-based metric is configured in the application code or Terraform at present.

### 4.6 Useful Cloud Logging searches

The following examples assume Cloud Run JSON logs. Adjust the project, time range, and resource filter in Logs Explorer.

Find the full path of one request:

```text
resource.type="cloud_run_revision"
jsonPayload.requestId="<request-id>"
```

Find application errors for one service:

```text
resource.type="cloud_run_revision"
jsonPayload.service="ai-assist"
jsonPayload.level="error"
```

Find failed Admin audit writes:

```text
resource.type="cloud_run_revision"
jsonPayload.service="admin"
jsonPayload.message="admin audit write failed (mutation already committed)"
```

Find slow request completion records:

```text
resource.type="cloud_run_revision"
jsonPayload.durationMs>=2000
```

## 5. Monitoring and health

### 5.1 Runtime health endpoints

| Component | Endpoint/check | What it proves | Important limitation |
|---|---|---|---|
| Shared Apollo subgraphs | `GET /health` | The HTTP process is listening | It does not check MongoDB or downstream commerce providers |
| BFF | `GET /healthz` | The BFF HTTP process is listening | It can return `ok` before federation composition succeeds; GraphQL may still be unavailable |
| AI Assist | `GET /health` | Process is responding and reports provider/configuration state | `status: ok` is not a live call to the selected LLM or commerce backend |
| Auth | `GET /health` | Auth process is responding | It is not a full dependency readiness check |
| Studio | `GET /api/health` | Studio can actively reach the BFF GraphQL endpoint and AI Assist | Only these two services are probed; each probe times out after 2.5 seconds |

The Studio Dashboard's **Core Service Health** card calls `/api/health` once when the dashboard loads. It displays `online`, `offline`, or `status unavailable` for Experience BFF and AI Assist. It is a user-facing point-in-time reachability view, not a continuously sampled monitoring system.

### 5.2 Platform telemetry

Terraform enables the Google Cloud Logging and Monitoring APIs, and the backend runs on Cloud Run. Cloud Run supplies platform telemetry such as request count, response latency, error responses, instance count, and container resource use in the Google Cloud console.

The repository does not currently define:

- Monitoring dashboards
- Alert policies or notification channels
- Uptime checks
- Log-based metrics
- Service-level indicators/objectives (SLIs/SLOs) or error budgets
- Custom application metrics
- Distributed traces or trace sampling
- Synthetic customer journeys

Deployment monitoring is currently operational/manual: GitHub Actions/Cloud Build run status, Cloud Run service and revision status, service logs, and the Studio health card.

### 5.3 Minimum recommended alerts

These are recommended future controls:

| Priority | Signal | Initial condition | Response |
|---|---|---|---|
| P1 | BFF or Studio external availability | Failed checks from multiple regions for 5 minutes | Page on-call |
| P1 | Elevated server errors | 5xx ratio above agreed threshold for 5 minutes | Page on-call |
| P1 | Audit persistence failure | Any Admin audit-write failure in production | Page Security/Platform; verify mutation and reconstruct evidence |
| P2 | Latency | p95 above endpoint-specific objective for 10 minutes | Notify service owner |
| P2 | Federation unavailable | BFF listening but GraphQL readiness fails | Notify Platform; inspect composition logs |
| P2 | AI tool failures | Failure ratio above baseline by tool/provider | Notify AI/service owner |
| P2 | Database/cache dependency | Connection error rate or saturation above threshold | Notify Platform |
| P3 | Deployment health | New revision does not become ready or error rate regresses | Stop/roll back rollout |

Thresholds should be derived from agreed SLOs and traffic baselines rather than copied unchanged from this table.

## 6. Operational investigation workflow

When a user reports a failed or unexpected action:

1. Capture the approximate UTC time, tenant/project, user-visible error, resource identifier, and `x-request-id` if available.
2. Search Studio/Vercel logs for the request ID to identify the originating API route.
3. Search Cloud Logging for the same `jsonPayload.requestId` across BFF, AI Assist, and subgraphs.
4. Follow timestamps, `service`, `module`, operation/tool name, status, and duration to locate the failing hop.
5. If the operation was an Admin mutation, query the tenant-scoped MongoDB audit collection to confirm whether a success record was inserted.
6. If the mutation succeeded but the audit insert failed, treat it as an evidence gap: preserve the correlated operational logs and reconstruct the audit record through the approved incident process.
7. Do not paste raw tokens, request bodies, customer content, or sensitive MongoDB documents into tickets or chat channels.

## 7. Access, retention, and governance

The repository does not define formal retention periods, legal holds, or role mappings for logs and audit data. Before production compliance claims are made, owners must approve and implement:

- Least-privilege access to Cloud Logging and the audit collection
- Tenant-scoped audit retrieval and export
- Separate retention policies for operational logs and security/business audit records
- Append-only/tamper-evident audit storage and controlled break-glass access
- Documented time synchronisation and UTC display conventions
- Data subject/privacy handling and redaction verification
- Audit schema versioning and migration
- Alert ownership, escalation routes, and incident evidence preservation
- Periodic tests proving that critical actions create an audit event and that alerts reach the intended responder

## 8. Known gaps and implementation priorities

| Priority | Gap | Recommended next step |
|---|---|---|
| P0 | Studio audit page shows generated data | Add a secured, tenant-scoped audit query and bind the page to persisted records; remove the generator from production |
| P0 | Critical business/AI actions are not comprehensively audited | Define a versioned audit event contract and instrument governed writes, denials, approvals, and failures |
| P0 | Audit insertion is best-effort after commit | Adopt a transactional outbox or another durable delivery design; alert on backlog/failure |
| P0 | No audit immutability or retention controls | Configure append-only access, archive/retention, integrity controls, and tested recovery |
| P1 | BFF liveness can be green while GraphQL is not ready | Separate liveness and readiness endpoints; make readiness depend on successful composition |
| P1 | No codified alerts/SLOs/dashboards | Add Terraform-managed uptime checks, alerts, notification channels, and service dashboards |
| P1 | Audit events cannot be correlated to request logs | Add `requestId`, event ID, actor type/ID, outcome, reason, and source service to the audit schema |
| P2 | No distributed tracing or central error tracking | Evaluate OpenTelemetry and an approved error/trace backend with strict redaction |
| P2 | PII safety depends partly on call-site discipline | Add logger-level redaction, lint/test rules, and automated secret/PII leakage checks |

## 9. Code reference map

| Area | Implementation |
|---|---|
| Shared logging facade and output format | `packages/logger/src/logger.ts` |
| Async request context | `packages/logger/src/context.ts` |
| HTTP/Express/Apollo access logging | `packages/logger/src/http.ts` |
| PII helpers | `packages/logger/src/redact.ts` |
| Cross-service header contract | `packages/headers/src/index.ts` |
| Shared subgraph `/health` endpoint | `packages/service-bootstrap/src/index.ts` |
| Admin mutation audit hook | `apps/admin/src/index.ts` |
| Admin audit persistence | `apps/admin/src/audit/repository.ts` |
| MongoDB audit collection configuration | `packages/mongodb/src/admin/db.ts` |
| AI tool execution traces | `apps/ai-assist/src/chat/tools/instrument.ts` |
| BFF health and composition behaviour | `apps/bff/src/index.ts` |
| Studio request correlation | `apps/studio/src/lib/request-logger.ts` |
| Studio active health probes | `apps/studio/src/app/api/health/route.ts` |
| Studio health display | `apps/studio/src/features/dashboard/Dashboard.tsx` |
| Studio demonstration audit data | `apps/studio/src/features/audit-log/hooks/use-audit-log.ts` |
| GCP services and Cloud Run infrastructure | `infra/gcp/main.tf` |
| Cloud Build log destination | `cloudbuild.yaml` |

