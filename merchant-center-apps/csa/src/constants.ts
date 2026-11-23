import { entryPointUriPathToPermissionKeys } from '@commercetools-frontend/application-shell/ssr';

export const entryPointUriPath = 'csa';

export const PERMISSION_GROUPS = {
  customers: 'customers',
  carts: 'carts',
  orders: 'orders',
  importExport: 'import-export',
  customAttributes: 'custom-attributes',
} as const;

export const PERMISSIONS = entryPointUriPathToPermissionKeys(
  entryPointUriPath,
  Object.values(PERMISSION_GROUPS)
);
