import {
  PERMISSION_GROUPS,
  PERMISSIONS,
  entryPointUriPath,
} from './src/constants';

const applicationId = process.env.CSA_MC_APPLICATION_ID || 'TODO';
const applicationUrl =
  process.env.CSA_MC_APPLICATION_URL ||
  'https://replace-before-deployment.example.com';

/** @type {import('@commercetools-frontend/application-config').ConfigOptionsForCustomApplication} */
const config = {
  name: 'CSA',
  description: 'Customer Service Accelerator for B2C operations',
  entryPointUriPath,
  cloudIdentifier: 'gcp-us',
  env: {
    development: {
      initialProjectKey:
        process.env.CTP_INITIAL_PROJECT_KEY || 'spotlightstores-demo',
    },
    production: {
      applicationId,
      url: applicationUrl,
    },
  },
  additionalEnv: {
    csaTicketApiUrl: process.env.CSA_MC_TICKET_API_URL || '',
    csaRefundApiUrl: process.env.CSA_MC_REFUND_API_URL || '',
  },
  oAuthScopes: {
    view: ['view_customers', 'view_orders'],
    manage: [],
  },
  additionalOAuthScopes: [
    {
      name: PERMISSION_GROUPS.customers,
      // Customer 360 includes promotion assignment and usage details.
      view: [
        'view_customers',
        'view_cart_discounts',
        'view_discount_codes',
        'view_types',
      ],
      // Promotion assignment stores Cart Discount references in a customer
      // Custom Type and can provision that Type when a Project is first used.
      manage: ['manage_customers', 'manage_types'],
    },
    {
      name: PERMISSION_GROUPS.carts,
      // Cart agents need catalogue access to search for variants when adding
      // line items. Keep this in the Carts permission group so the workflow
      // does not depend on a second CSA permission-group assignment.
      view: ['view_orders', 'view_products'],
      manage: ['manage_orders'],
    },
    {
      name: PERMISSION_GROUPS.orders,
      view: ['view_orders', 'view_payments'],
      manage: ['manage_orders', 'manage_payments'],
    },
    {
      name: PERMISSION_GROUPS.products,
      view: ['view_products'],
      manage: [],
    },
    {
      name: PERMISSION_GROUPS.shoppingLists,
      // Wishlist agents also need catalogue access to find product variants
      // before adding them to a customer's shopping list.
      view: ['view_shopping_lists', 'view_products'],
      manage: ['manage_shopping_lists'],
    },
    {
      name: PERMISSION_GROUPS.importExport,
      view: ['view_customers', 'view_orders'],
      manage: ['manage_customers', 'manage_orders'],
    },
    {
      name: PERMISSION_GROUPS.customAttributes,
      view: ['view_types'],
      manage: ['manage_types'],
    },
  ],
  icon: '${path:@commercetools-frontend/assets/application-icons/headphones.svg}',
  mainMenuLink: {
    defaultLabel: 'CSA',
    labelAllLocales: [],
    permissions: [PERMISSIONS.View],
  },
  submenuLinks: [
    {
      uriPath: 'dashboard',
      defaultLabel: 'Dashboard',
      labelAllLocales: [],
      permissions: [PERMISSIONS.View],
    },
    {
      uriPath: 'customers',
      defaultLabel: 'Customers',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewCustomers],
    },
    {
      uriPath: 'carts',
      defaultLabel: 'Carts',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewCarts],
    },
    {
      uriPath: 'orders',
      defaultLabel: 'Orders',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewOrders],
    },
    {
      uriPath: 'returns',
      defaultLabel: 'Returns',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewOrders],
    },
    {
      uriPath: 'products',
      defaultLabel: 'Products',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewProducts],
    },
    {
      uriPath: 'tickets',
      defaultLabel: 'Tickets',
      labelAllLocales: [],
      permissions: [PERMISSIONS.View],
    },
    {
      uriPath: 'import',
      defaultLabel: 'Import',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewImportExport],
    },
    {
      uriPath: 'export',
      defaultLabel: 'Export',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewImportExport],
    },
    {
      uriPath: 'custom-attributes',
      defaultLabel: 'Custom Attributes',
      labelAllLocales: [],
      permissions: [PERMISSIONS.ViewCustomAttributes],
    },
    {
      uriPath: 'knowledge-base',
      defaultLabel: 'Knowledge Base',
      labelAllLocales: [],
      permissions: [PERMISSIONS.View],
    },
  ],
};

export default config;
