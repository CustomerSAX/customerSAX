# DW Feature Gap Analysis

Comparison of Direct Wines' requested CSA capability list against the current `customerSAX` CSA implementation.

## Executive Summary

Our CSA already has a strong generic accelerator foundation:

- Studio web app with dashboard, customers, orders, carts, products, tickets, reports, knowledge base, audit log, B2B views, and CSA Assistant.
- Apollo BFF and commerce contract with a working commercetools adapter.
- Ticketing, admin, auth, AI Assist, shared UI, logging, MongoDB, cache, and GCP/Terraform foundations.
- Generic OIDC SSO flow, role records, session APIs, project/client context headers, and some UI permission filtering.

The DW request is much more domain-specific. The main gaps are:

- Microsoft Entra + Curity-specific auth, MFA, claims, AD group, role, and market mapping.
- DW market/brand configuration for UK, US, AU, and NZ.
- Direct Wines API/microservice integration layer.
- Algolia, Bloomreach, Five9, Contentful, Veratad, address lookup, payment provider, D365/ERP, WMS/OMS, New Relic, OpenSearch, and Netlify-specific integrations.
- Wine domain workflows: wine plans, Personal Wine Advisor, advisor diary, task queues, pre-sale, storage/fine wine, delivered-case payment, internal orders.
- Rich Customer 360, consent, marketing history, combined chronological history, reference data, telemetry, and DW-specific audit/event model.

## Coverage Legend

- **Present**: implemented as a generic CSA capability.
- **Partial**: similar foundation exists, but not complete or not DW-specific.
- **Missing**: no clear implementation found in the current codebase.

## Feature Comparison

| DW area | Current CSA coverage | Difference / gap |
|---|---:|---|
| Authentication and access | Partial | Generic password auth, sessions, OIDC/PKCE start/callback, role repository, and project/client context exist. Missing Entra-specific setup, Curity flow, MFA handling, Grapevine AD group mapping, DW claim mapping, market-based access, and full backend permission enforcement per business action. |
| Agent dashboard | Partial | Dashboard exists with real ticket KPIs/work queue and BFF/AI health. Missing held tasks, diary/upcoming activities, operational shortcuts, market-aware content, filters, and DW workload counters. |
| Customer search | Present / Partial | Customer search/list/detail routes and GraphQL queries exist. Missing DW-specific market/brand-aware search rules and placeholder email handling. |
| Customer 360/profile | Partial | Customer detail has overview, orders, returns, quotes, payments, tickets, conversations, and notes tabs. Missing many DW fields: membership/account status, last order indicator, failed payment indicator, segment, wine plan, Personal Wine Advisor, communication permissions, marketing history, service chronology, tasks, and diary entries. |
| Customer creation/maintenance | Partial | Create/update customer and address mutations exist. Missing market-specific validation, placeholder email lifecycle, cancellation reasons, account cancellation prevention rules, and DW API-backed updates. |
| Communication preferences/consent | Missing | No dynamic consent model for email/phone/SMS or market/brand consent types was found. |
| Segmentation and marketing | Missing | No Bloomreach segmentation or marketing-history integration found. |
| Agent messages/notes | Partial | Notes/conversation UI exists and tickets can hold history-like context. Missing agent message publishing, expiry/end dates, active message display, completion, bulk creation, and customer-history integration. |
| Customer service history | Partial | Orders, tickets, returns, and conversations are separated by tabs. Missing one combined chronological customer history with order events, profile changes, agent actions, Five9, chat, email, notes, and audit events. |
| Product search | Partial | Product list/search/detail and quick search exist through the commerce adapter. Missing Algolia integration, agent-specific indexes, Algolia Insights, multi-select wine facets, market availability rules, and DW wine taxonomy filters. |
| Product and stock information | Partial | Product details and standalone prices exist. Missing stock status, compliance fields, contextual/customer pricing rules, Happy-to-Wait behavior, and DW API availability rules. |
| Recruitment/campaign offers | Missing / Partial | Discount codes/promotions exist in generic commerce. Recruitment offers, campaign offers, DW offer service, and campaign rule ownership are not implemented. |
| Cart/incomplete orders | Partial | Cart list/detail/create/update/place-order flows exist, including line items, discounts, shipping, and addresses. Missing cart origin model, customer-vs-agent cart ownership, takeover/clone decisioning, DW lifecycle APIs, and simultaneous edit safeguards. |
| Standard order creation | Partial | Cart-to-order flow exists, with CSA Assistant and cart screens. Missing complete DW sales-order flow with hosted payment, market-specific behavior, explicit tax/discount/promotion guardrails, and DW order-type rules. |
| Order list/search | Present / Partial | Order list/search/detail exists. DW-specific filters, fulfillment context, and order-type semantics need extension. |
| Order details | Partial | Order detail tabs include general, shipping, payments, returns, and comments. Missing backend-state-driven action matrix and DW-specific return/refund/replacement/shipment transaction model. |
| Order available actions | Missing / Partial | CSA Assistant has generic update/cancel/return style tools, and order update mutation exists. DW actions such as request stop, cancel line, arrange collection, courtesy refund, replacement, send receipt, take payment, and raise task are not implemented as governed actions. |
| Request stop | Missing | No shipment/order stop workflow found. |
| Order cancellation | Partial | Generic order update and AI cancel-order tool exist. Missing complete/line cancellation UI, reason codes, eligibility validation, confirmation token/server governance, and audit model. |
| Returns | Partial | Return info display and AI start-return capability exist. Missing DW return workflow, reason codes, collection, replacement alongside return, backend processing, and status lifecycle. |
| Refunds | Missing / Partial | Refund is not a distinct capability; some refund wording exists around returns. Missing courtesy refund, eligible-line refund, amount/reason validation, refund status, and audit. |
| Delivery updates | Missing / Partial | Cart shipping/address updates exist. Order delivery update rules driven by backend are not implemented. |
| Multi-shipment/multi-address | Missing | No order-line-to-address or multiple shipment model found. |
| Payments | Missing / Partial | Payment display exists on order/customer views. Missing hosted payment iframe/component, provider abstraction, market-specific providers, capture, success/failure handling, Five9 recording pause/resume, special-scenario payment, and payment audit. |
| Discounts | Partial | Discount codes and manual cart line price mutation exist. Missing DW manual item/order discount workflow, reason/audit, pre-sale restrictions, BFF business validation, and order-type restrictions. |
| Pre-sale | Missing | No pre-sale transaction/status/balance/deposit workflow found. |
| Storage/fine wine | Missing | No stored cases, duty/tax, bonded storage transfer, condition report, or storage-task workflow found. |
| Take payment for delivered case | Missing | No delivered-case duplicate/replacement payment workflow found. |
| Internal orders | Missing / Partial | Generic order/cart flow could be reused. Missing internal order type, internal pricing/channel rules, and UK-specific model. |
| Subscriptions/wine plans | Missing | No subscription/wine-plan contract or UI found. |
| Personal Wine Advisor | Missing | No advisor assignment/contact/transfer/Five9 routing model found. |
| Wine Advisor diary | Missing | No diary/to-do calendar model found. |
| Task management | Partial / Missing | Ticketing exists, but DW task management is broader: task categories, queues, held tasks, get-next-task, locking, routing-by-email, ATM integration, and no cherry-picking rules are not implemented. |
| Five9 telephony | Missing | No Five9 API, SDK, screen pop, click-to-dial, call state, disposition, pause/resume recording, or call logging implementation found. |
| Outbound call management | Missing | No outbound call outcome/disposition/synchronization workflow found. |
| Knowledge base | Partial | Static FAQ/troubleshooting knowledge base UI exists. Missing DW-approved content source, search, categories/article detail backed by API/CMS/config, and Contentful validation. |
| Reference data | Missing / Partial | Some hardcoded options exist. Missing API-driven lookup lists, cache/refresh/last-known-good behavior, and DW master/reference data service integration. |
| Configuration management | Partial | Environment variables, secrets, project/client config, and Terraform exist. Missing market/brand config, feature flags, order types, reason codes, regional business config, and ownership model. |
| Multi-market support | Partial | Client/project context and commerce project config exist. Missing UK/US/AU/NZ market context, brand context, regional feature visibility, consent/payment/delivery/order/business rules. |
| Localisation | Partial | commercetools localized names/descriptions are handled in places. Missing CSA-wide market label/content localization source. |
| Audit logging | Partial | Admin audit repository and audit log UI exist. Missing broad customer/order/refund/task/security/permission event coverage and agreed DW audit schema. |
| Logging and monitoring | Partial | Structured logger and request IDs exist; GCP infra exists. Missing OpenSearch, New Relic, Netlify runtime logging, alerting, and dependency/cache/reference-data dashboards. |
| Application telemetry | Missing | No agreed page/search/click/journey/product insight/business workflow event model found. |
| Performance/load/browser/session behavior | Missing / Partial | Session routes and per-tab UI state exist in places. Missing formal load tests, cross-browser tests, multi-tab/customer/cart isolation tests, token refresh testing, and stale-response safeguards. |
| Caching | Partial | Shared cache package exists. Missing DW-specific BFF/reference/read caching strategy, market/access-aware keys, last-known-good fallback, and refresh monitoring. |
| Error handling/resilience | Partial | Route-level error handling and request correlation exist. Missing standardized timeout/retry/idempotency/fallback policy across all DW workflows. |
| Reporting/analytics | Partial | Reports UI/export shell exists. Missing DW reporting ecosystem integration and agreed operational/event data feed. |
| External integrations | Missing / Partial | commercetools exists; generic OIDC exists. DW-named integrations are mostly absent: Entra, Curity, DW AWS APIs/microservices, Algolia, Five9, Bloomreach, Contentful, Veratad, address lookup, payment providers, D365/ERP, WMS/OMS, New Relic, OpenSearch, Netlify. |

## Strong Existing Foundations To Reuse

- `apps/studio`: main CSA UI shell and feature pages.
- `apps/commerce/contract`: platform-neutral GraphQL contract for customers, products, carts, orders, quotes, companies, and agents.
- `apps/commerce/commercetools`: working commercetools adapter.
- `apps/bff`: Apollo gateway.
- `apps/auth`: auth/session service.
- `apps/admin`: roles, clients, settings, and audit subgraph.
- `apps/ticketing`: MongoDB-backed ticketing.
- `apps/ai-assist`: AI assistant with commerce and ticket tools.
- `packages/ui`: shared Meridian-style component library.
- `packages/logger`, `packages/cache`, `packages/mongodb`, `packages/headers`: operational foundations.

## Recommended Delivery Slices For DW

1. **Identity and tenancy first**: Entra + Curity, MFA assumptions, Grapevine AD group mapping, role/permission model, UK/US/AU/NZ market context, and backend enforcement.
2. **DW integration contract**: define adapter/BFF contracts for DW APIs, reference data, consent, customer profile, tasks, diary, offers, and order actions.
3. **Customer 360 MVP**: customer overview, consent, marketing history, notes/messages, service chronology, tasks, orders, carts, and diary in one place.
4. **Order action governance**: available-action matrix, cancellation, returns, refunds, delivery updates, request stop, audit, and confirmation/approval pattern.
5. **Commerce domain extensions**: Algolia product search, stock/compliance, recruitment/campaign offers, discounts, payment component, multi-market pricing/tax/delivery behavior.
6. **Wine-specific workflows**: subscriptions/wine plans, Personal Wine Advisor, advisor diary, task queues, pre-sale, storage/fine wine, internal orders, delivered-case payment.
7. **Operational readiness**: telemetry, monitoring, OpenSearch/New Relic, reference-data cache, load/browser/session tests, and DW reporting events.

