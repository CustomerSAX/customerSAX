import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { getCustomerByEmail, getCustomerById, listCustomers } from "../../../commercetools/api/index.js";
import { mapCustomer } from "./customer.mapper.js";
import type { CtCustomer } from "../../../commercetools/types.js";
import { compactWhere, escapeWhere, page, paging, sort, type PagingArgs } from "../shared/paging.js";
import type { CustomerSearchArgs } from "./customer.types.js";

const customerFields = `#graphql
  id
  customerNumber
  email
  firstName
  lastName
`;

export const resolvers = {
  customer: (_parent: unknown, args: { email?: string; id?: string }) =>
    args.email ? getCustomerByEmail(args.email) : args.id ? getCustomerById(args.id) : null,
  customers: (_parent: unknown, args: PagingArgs) => listCustomers(args),
  customerPage: async (_parent: unknown, args: CustomerSearchArgs) => queryCustomers(customerListWhere(args), args),
  searchCustomers: async (_parent: unknown, args: CustomerSearchArgs) => queryCustomers(customerSearchWhere(args), args),
  customersByEmails: async (_parent: unknown, args: { emails: string[] }) => {
    if (!args.emails.length) {
      return [];
    }

    const where = args.emails.map((email) => `email="${escapeWhere(email)}"`).join(" or ");
    const data = await commercetoolsGraphql<{ customers: { results: CtCustomer[] } }>(
      `#graphql
        query CustomersByEmails($where: String!, $limit: Int!) {
          customers(where: $where, limit: $limit) {
            results { ${customerFields} }
          }
        }
      `,
      { limit: Math.min(args.emails.length, 500), where }
    );

    return data.customers.results.map(mapCustomer).filter(Boolean);
  },
  b2bCustomers: async (_parent: unknown, args: CustomerSearchArgs) => queryCustomers(customerSearchWhere(args), args),
  customerAddresses: async (_parent: unknown, args: { id: string }) =>
    commercetoolsGraphql(
      `#graphql
        query CustomerAddresses($id: String!) {
          customer(id: $id) {
            id
            addresses {
              id streetName streetNumber city region state country company department
              building apartment pOBox phone mobile email firstName lastName postalCode
            }
            shippingAddressIds
            billingAddressIds
            defaultShippingAddressId
            defaultBillingAddressId
          }
        }
      `,
      { id: args.id }
    ),
  customerShoppingLists: (_parent: unknown, args: PagingArgs & { id: string; wishlist?: boolean }) => {
    const { limit, offset } = paging(args);

    return commercetoolsGraphql(
      `#graphql
        query CustomerShoppingLists($where: String!, $limit: Int!, $offset: Int!, $sort: [String!]) {
          shoppingLists(where: $where, limit: $limit, offset: $offset, sort: $sort) {
            total
            count
            offset
            results {
              id key nameAllLocales { locale value } customer { id email }
              lineItems { id productId variantId quantity nameAllLocales { locale value } }
            }
          }
        }
      `,
      {
        limit,
        offset,
        sort: sort(args),
        where: compactWhere([
          `customer(id="${escapeWhere(args.id)}")`,
          args.wishlist ? `custom(fields(isWishlist=true))` : undefined
        ])
      }
    );
  },
  customerPromotions: (_parent: unknown, args: { id: string }) =>
    commercetoolsGraphql(
      `#graphql
        query CustomerPromotions($id: String!) {
          customer(id: $id) {
            id
            customerGroup { id name key }
            customerGroupAssignments { customerGroup { id key name } }
          }
        }
      `,
      { id: args.id }
    ),
  createCustomer: async (_parent: unknown, args: { draft: Record<string, unknown> }) => {
    const data = await commercetoolsGraphql<{ customerSignUp: { customer: CtCustomer } }>(
      `#graphql
        mutation CreateCustomer($draft: CustomerSignUpDraft!) {
          customerSignUp(draft: $draft) { customer { ${customerFields} } }
        }
      `,
      { draft: args.draft }
    );

    return mapCustomer(data.customerSignUp.customer);
  },
  updateCustomer: async (_parent: unknown, args: { draft: Record<string, unknown>; id: string }) =>
    updateCustomer(args.id, customerUpdateActions(args.draft)),
  updateCustomerProfile: async (_parent: unknown, args: { draft: Record<string, unknown>; id: string }) =>
    updateCustomer(args.id, customerProfileActions(args.draft)),
  addCustomerAddress: async (
    _parent: unknown,
    args: { address: Record<string, unknown>; addressType?: string; id: string }
  ) => {
    const actions: unknown[] = [{ addAddress: { address: args.address } }];
    const data = await updateCustomerRaw(args.id, actions);
    const addresses = (data.updateCustomer?.addresses ?? []) as Array<{ id?: string }>;
    const addressId = addresses[addresses.length - 1]?.id;

    if (addressId && args.addressType === "shipping") {
      return updateCustomerRaw(args.id, [{ addShippingAddressId: { addressId } }]);
    }
    if (addressId && args.addressType === "billing") {
      return updateCustomerRaw(args.id, [{ addBillingAddressId: { addressId } }]);
    }

    return data;
  },
  updateCustomerAddress: (_parent: unknown, args: { address: Record<string, unknown>; addressId: string; id: string }) =>
    updateCustomerRaw(args.id, [{ changeAddress: { address: args.address, addressId: args.addressId } }]),
  removeCustomerAddress: (_parent: unknown, args: { addressId: string; id: string }) =>
    updateCustomerRaw(args.id, [{ removeAddress: { addressId: args.addressId } }]),
  setDefaultCustomerAddress: (_parent: unknown, args: { addressId: string; id: string; kind: string }) =>
    updateCustomerRaw(args.id, [
      args.kind === "billing"
        ? { setDefaultBillingAddress: { addressId: args.addressId } }
        : { setDefaultShippingAddress: { addressId: args.addressId } }
    ])
};

async function queryCustomers(where: string | undefined, args: PagingArgs) {
  const { limit, offset } = paging(args);
  const data = await commercetoolsGraphql<{ customers: { results: CtCustomer[]; total?: number } }>(
    `#graphql
      query CustomersPage($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
        customers(limit: $limit, offset: $offset, sort: $sort, where: $where) {
          total
          results { ${customerFields} }
        }
      }
    `,
    { limit, offset, sort: sort(args), where }
  );

  return page(data.customers.results.map(mapCustomer).filter(Boolean), data.customers.total, offset);
}

function customerListWhere(args: CustomerSearchArgs) {
  return compactWhere([
    args.groupId ? `customerGroup(id="${escapeWhere(args.groupId)}")` : undefined,
    args.excludeGroupId ? `not(customerGroup(id="${escapeWhere(args.excludeGroupId)}"))` : undefined
  ]);
}

function customerSearchWhere(args: CustomerSearchArgs) {
  const text = args.text?.trim();
  const textWhere = text ? customerTextWhere(args.option, text) : undefined;

  return compactWhere([textWhere, customerListWhere(args), customerFilterWhere(args.filters)]);
}

function customerTextWhere(option: string | undefined, text: string) {
  const value = escapeWhere(text);

  switch (option) {
    case "id":
    case "key":
    case "email":
    case "firstName":
    case "lastName":
    case "companyName":
    case "customerNumber":
    case "externalId":
      return `${option}="${value}"`;
    default:
      return `email="${value}" or firstName="${value}" or lastName="${value}" or customerNumber="${value}" or externalId="${value}"`;
  }
}

function customerFilterWhere(filters: Record<string, unknown> | undefined) {
  if (!filters) {
    return undefined;
  }

  return compactWhere([
    stringFilter(filters.groupId) ? `customerGroup(id="${escapeWhere(String(filters.groupId))}")` : undefined,
    stringFilter(filters.groupAssignmentsId)
      ? `customerGroupAssignments(customerGroup(id="${escapeWhere(String(filters.groupAssignmentsId))}"))`
      : undefined
  ]);
}

function customerProfileActions(draft: Record<string, unknown>) {
  return [
    fieldAction("setFirstName", "firstName", draft.firstName),
    fieldAction("setLastName", "lastName", draft.lastName),
    fieldAction("setCompanyName", "companyName", draft.companyName),
    fieldAction("setDateOfBirth", "dateOfBirth", draft.dateOfBirth)
  ].filter(Boolean);
}

function customerUpdateActions(draft: Record<string, unknown>) {
  return [
    fieldAction("setCustomerGroup", "customerGroup", draft.customerGroupId ? { id: draft.customerGroupId } : null),
    fieldAction("setExternalId", "externalId", draft.externalId),
    fieldAction("setCustomerNumber", "customerNumber", draft.customerNumber)
  ].filter(Boolean);
}

function fieldAction(action: string, field: string, value: unknown) {
  return value === undefined ? undefined : { [action]: { [field]: value } };
}

async function updateCustomer(id: string, actions: unknown[]) {
  const data = await updateCustomerRaw(id, actions);

  return mapCustomer(data.updateCustomer as CtCustomer | null);
}

async function updateCustomerRaw(id: string, actions: unknown[]) {
  const customer = await getCustomerVersion(id);

  return commercetoolsGraphql<{ updateCustomer: Record<string, unknown> | null }>(
    `#graphql
      mutation UpdateCustomer($id: String!, $version: Long!, $actions: [CustomerUpdateAction!]!) {
        updateCustomer(id: $id, version: $version, actions: $actions) {
          ${customerFields}
          addresses { id streetName streetNumber city region state country postalCode firstName lastName }
          shippingAddressIds
          billingAddressIds
          defaultShippingAddressId
          defaultBillingAddressId
        }
      }
    `,
    { actions, id, version: customer.version }
  );
}

async function getCustomerVersion(id: string) {
  const data = await commercetoolsGraphql<{ customer: { version: number } | null }>(
    `#graphql
      query CustomerVersion($id: String!) { customer(id: $id) { version } }
    `,
    { id }
  );

  if (!data.customer) {
    throw new Error("Customer not found.");
  }

  return data.customer;
}

function stringFilter(value: unknown) {
  return typeof value === "string" && value.trim();
}
