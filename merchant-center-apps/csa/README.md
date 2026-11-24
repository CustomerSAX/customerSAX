# CSA Merchant Center Custom Application

Standalone B2C Customer Service Accelerator for the commercetools Merchant Center.

This application is deliberately isolated from the CustomerSAX workspace:

- it is not listed in the repository root `pnpm-workspace.yaml`;
- it has its own dependencies, lockfile, Node version, build, tests, and deployment;
- it does not import CustomerSAX packages or use CustomerSAX authentication;
- commercetools requests use the logged-in Merchant Center session.

## Application identity

| Setting              | Value                  |
| -------------------- | ---------------------- |
| Name and menu label  | `CSA`                  |
| Entry-point URI path | `csa`                  |
| Development project  | `spotlightstores-demo` |
| Cloud identifier     | `gcp-us`               |

## Local development

The current Application Kit requires Node `^22.23.4`, `^24.22.1`, or `>=26.12.1`. This standalone app pins Node 26 without changing the CustomerSAX runtime.

```sh
cd merchant-center-apps/csa
nvm use
corepack pnpm install
corepack pnpm start
```

The development server opens on `http://localhost:3001` and redirects through Merchant Center authentication.

The ignored local `.env` enables the JSX transform and fast refresh expected by
the Merchant Center Application Kit. Keep project and deployment overrides in
environment variables or `.env.local`. The Vercel build configuration enables
the same JSX transform for production builds without committing local settings.

## Verification

```sh
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

## Production configuration

Set these build-time environment variables:

```sh
CTP_INITIAL_PROJECT_KEY=spotlightstores-demo
CSA_MC_APPLICATION_ID=<registered-custom-application-id>
CSA_MC_APPLICATION_URL=https://<standalone-csa-host>
CSA_MC_TICKET_API_URL=https://<public-csa-bff>/merchant-center/tickets
CSA_MC_REFUND_API_URL=https://<public-csa-bff>/merchant-center/refunds
CSA_MC_REPLACEMENT_API_URL=https://<public-csa-bff>/merchant-center/replacements
```

The Application ID is only available after the application is registered in Merchant Center. The placeholder configuration must not be used for a production build.

## Merchant Center registration

1. Open **Manage organizations & teams → Custom Applications → Configure Custom Applications**.
2. Add a Custom Application named **CSA**.
3. Set the entry point to `csa`.
4. Set the application URL to the independently deployed CSA URL.
5. Configure the default and additional permission groups to match `custom-application-config.mjs`.
6. Copy the generated Application ID into `CSA_MC_APPLICATION_ID`, rebuild, and redeploy.
7. Move the application to **Ready**, install it for the intended projects, and assign CSA permissions to Merchant Center teams.

The configured scopes are narrowly grouped around customers, carts/orders,
payments, products, import/export, and Types. The **Carts** permission group
also includes `view_products`, because adding a cart line item requires
catalogue search access. Do not replace these scopes with `manage_project`.

## Deployment

`pnpm build` produces the deployable static application in `public/`. Host that directory independently on a static HTTPS host. Merchant Center provides the shell, navigation, authentication, project selector, locale, and user context.

The default CSP is inferred from the `gcp-us` cloud identifier and production URL. Add custom `connect-src` values only when a separate CSA backend is introduced.

### Vercel

Import this repository into Vercel and configure the project as follows:

| Setting          | Value                      |
| ---------------- | -------------------------- |
| Root Directory   | `merchant-center-apps/csa` |
| Framework Preset | `Other`                    |
| Node.js          | `26.x`                     |

The committed `vercel.json` installs dependencies, builds the static app into
`public/`, enables the JSX transform, and rewrites all Merchant Center deep
links to `index.html`.

Add the following variables in **Vercel → Project Settings → Environment
Variables** for Production (and Preview when preview deployments need to run):

```sh
CTP_INITIAL_PROJECT_KEY=<real-project-key>
CSA_MC_APPLICATION_ID=<registered-custom-application-id>
CSA_MC_APPLICATION_URL=https://<stable-vercel-production-domain>
CSA_MC_TICKET_API_URL=https://<public-csa-bff>/merchant-center/tickets
CSA_MC_REFUND_API_URL=https://<public-csa-bff>/merchant-center/refunds
CSA_MC_REPLACEMENT_API_URL=https://<public-csa-bff>/merchant-center/replacements
```

Use the stable production domain, not a deployment-specific preview URL. After
changing any `CSA_MC_*` build variable, redeploy so that
the build-time values are included in the generated application.

For the initial bootstrap, deploy once to reserve the stable Vercel domain,
register that domain as the Custom Application URL in Merchant Center, copy the
generated Application ID into Vercel, and redeploy. Do not promote the Merchant
Center registration to **Ready** until the second deployment succeeds.

## Ticket integration

Tickets are loaded from the existing CSA ticketing service (MongoDB by
default) through `POST /merchant-center/tickets` on the BFF. The browser uses
Merchant Center `/proxy/forward-to`; the BFF validates the short-lived exchange
JWT, `ViewCsa` permission, and project key before resolving the owning CSA
tenant. No MongoDB or commercetools credentials are exposed to the browser.

Set `CSA_MC_TICKET_API_URL` to the complete public adapter URL and set the
BFF's `MC_TICKETS_AUDIENCE` to that URL's origin. The BFF also needs
`MONGO_URI`, and its `FEDERATED_SERVICES` configuration must include the
ticketing subgraph.

Bulk import execution still requires a dedicated bounded backend workflow; the
current UI only validates and previews CSV data.

## Refund integration

The Customer 360 **Returns** tab sends refunds through
`POST /merchant-center/refunds` on the BFF using Merchant Center
`/proxy/forward-to`. The BFF checks the installed application's
`ManageCsaOrders` permission, resolves the tenant
from the verified project key, verifies the returned items and refundable
amount, and records the Payment and Order updates in commercetools.

Set `CSA_MC_REFUND_API_URL` to the complete public adapter URL. Configure the
BFF with `MC_REFUNDS_AUDIENCE` set to that URL's origin. The tenant's
commercetools API client needs `manage_orders` and `manage_payments`. Reinstall
or update the Custom Application permissions after adding the `manage_payments`
scope to the **Orders** permission group.

## Replacement integration

The Customer 360 **Returns** tab can create a separate zero-value replacement
order for an eligible returned line item through
`POST /merchant-center/replacements`. The original order is not edited. The
replacement order copies its customer and delivery addresses, uses the selected
SKU and quantity, and stores a deterministic `purchaseOrderNumber` reference so
retries return the existing replacement instead of creating a duplicate.

Set `CSA_MC_REPLACEMENT_API_URL` to the complete public adapter URL and set the
BFF `MC_REPLACEMENTS_AUDIENCE` to that URL's origin. The tenant commercetools
API client needs `manage_orders`; no payment-provider credentials are required
because the replacement order total is zero.

## Available routes

- `/dashboard`
- `/customers`, `/customers/new`, and `/customers/:id`
- `/carts` and `/carts/:id`
- `/orders` and `/orders/:id`
- `/returns`
- `/products` and `/products/:id`
- `/tickets`
- `/import`
- `/export`
- `/custom-attributes`
- `/knowledge-base`

The root `/:projectKey/csa` route redirects to the dashboard. Submenu visibility and direct-route access are both permission protected.

## B2C feature set

The modern `csa` application carries forward the B2C-capable parts of the
legacy `rc-csa` experience without importing its obsolete runtime, embedded
credentials, or B2B-only integrations.

- Customer list, prefix search, creation, and editable 360-degree profile.
- Customer summary, carts, orders, returns, payments, addresses, tickets,
  password reset, wishlists, promotions, and custom attributes.
- Cart detail, line-item quantity changes, discount-code management, and order
  placement.
- Order detail, order/payment/shipment state changes, return creation,
  delivery/payment views, comments view, and custom attributes.
- Product catalogue browsing with searchable page results, full product
  details, variants, prices, inventory, and attributes.
- A B2C support knowledge base with FAQs and troubleshooting guidance.
- Click-through navigation from customer rows to customer 360, and from cart
  and order rows to their full detail screens.

Companies, business units, associates, quotes, budgets, approval rules, and
other B2B resources are intentionally excluded. Legacy ATG, AI-agent, ticket,
and promotion microservices are also not copied into the browser application;
those capabilities require independently authenticated backends. Native
commercetools B2C resources continue to work without such a backend.
