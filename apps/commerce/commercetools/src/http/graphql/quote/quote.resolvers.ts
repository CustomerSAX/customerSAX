import { commercetoolsGraphql, escapeWhere } from "../../../commercetools/client.js";
import { compactWhere, page, paging, sort, type PagingArgs } from "../shared/paging.js";

type QuoteArgs = PagingArgs & {
  companyKey?: string;
  customerId?: string;
};

type QuoteRecord = {
  billingAddress?: CtAddress;
  businessUnit?: {
    key?: string;
    name?: string;
  };
  comment?: string;
  companyKey?: string;
  companyName?: string;
  createdAt?: string;
  customer?: {
    email?: string;
    firstName?: string;
    id?: string;
    lastName?: string;
  };
  customerEmail?: string;
  customerId?: string;
  id: string;
  key?: string;
  lastModifiedAt?: string;
  lineItemCount?: number;
  lineItems?: QuoteLineItemRecord[];
  quoteNumber?: string;
  shippingAddress?: CtAddress;
  status?: string;
  totalPrice?: {
    centAmount: number;
    currencyCode: string;
    fractionDigits: number;
  };
};

type CtAddress = {
  additionalAddressInfo?: string | null;
  additionalStreetInfo?: string | null;
  apartment?: string | null;
  building?: string | null;
  city?: string | null;
  country?: string | null;
  mobile?: string | null;
  pOBox?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  state?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
};

type CtMoney = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

type CtLineItem = {
  id: string;
  nameAllLocales?: Array<{ value?: string | null }> | null;
  price?: {
    value?: CtMoney | null;
  } | null;
  productId?: string | null;
  quantity: number;
  totalPrice?: CtMoney | null;
  variant?: {
    sku?: string | null;
  } | null;
};

type CtQuoteRequest = {
  billingAddress?: CtAddress | null;
  businessUnit?: {
    key?: string | null;
    name?: string | null;
  } | null;
  comment?: string | null;
  createdAt?: string;
  customer?: {
    email?: string;
    firstName?: string | null;
    id: string;
    lastName?: string | null;
  } | null;
  id: string;
  key?: string | null;
  lastModifiedAt?: string;
  lineItems?: CtLineItem[] | null;
  quoteRequestState?: string | null;
  shippingAddress?: CtAddress | null;
  totalPrice?: CtMoney | null;
  version?: number;
};

type QuoteLineItemRecord = {
  id: string;
  name: string;
  productId?: string;
  quantity: number;
  sku?: string;
  totalPrice: CtMoney;
  unitPrice?: CtMoney;
};

type QuoteRequestResponse = {
  quoteRequest?: CtQuoteRequest | null;
};

type QuoteRequestsResponse = {
  quoteRequests: {
    count: number;
    offset: number;
    results: CtQuoteRequest[];
    total: number;
  };
};

type CartVersionResponse = {
  cart?: {
    version: number;
  } | null;
};

type CreateQuoteRequestResponse = {
  createQuoteRequest: {
    id: string;
    quoteRequestState?: string | null;
    version?: number;
  };
};

const QUOTE_REQUESTS_QUERY = /* GraphQL */ `
  query QuoteRequests($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
    quoteRequests(limit: $limit, offset: $offset, sort: $sort, where: $where) {
      total
      count
      offset
      results {
        id
        key
        version
        quoteRequestState
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        businessUnit {
          key
          name
        }
        customer {
          id
          firstName
          lastName
          email
        }
        shippingAddress {
          streetNumber
          streetName
          apartment
          building
          pOBox
          city
          state
          postalCode
          country
          phone
          mobile
          additionalStreetInfo
          additionalAddressInfo
        }
        billingAddress {
          streetNumber
          streetName
          apartment
          building
          pOBox
          city
          state
          postalCode
          country
          phone
          mobile
          additionalStreetInfo
          additionalAddressInfo
        }
        comment
        createdAt
        lastModifiedAt
        lineItems {
          id
          productId
          variant {
            sku
          }
          nameAllLocales {
            value
          }
          quantity
          price {
            value {
              centAmount
              currencyCode
              fractionDigits
            }
          }
          totalPrice {
            centAmount
            currencyCode
            fractionDigits
          }
        }
      }
    }
  }
`;

const QUOTE_REQUEST_QUERY = /* GraphQL */ `
  query QuoteRequest($id: String!) {
    quoteRequest(id: $id) {
      id
      key
      version
      quoteRequestState
      totalPrice {
        centAmount
        currencyCode
        fractionDigits
      }
      businessUnit {
        key
        name
      }
      customer {
        id
        firstName
        lastName
        email
      }
      shippingAddress {
        streetNumber
        streetName
        apartment
        building
        pOBox
        city
        state
        postalCode
        country
        phone
        mobile
        additionalStreetInfo
        additionalAddressInfo
      }
      billingAddress {
        streetNumber
        streetName
        apartment
        building
        pOBox
        city
        state
        postalCode
        country
        phone
        mobile
        additionalStreetInfo
        additionalAddressInfo
      }
      comment
      createdAt
      lastModifiedAt
      lineItems {
        id
        productId
        variant {
          sku
        }
        nameAllLocales {
          value
        }
        quantity
        price {
          value {
            centAmount
            currencyCode
            fractionDigits
          }
        }
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`;

const CART_VERSION_QUERY = /* GraphQL */ `
  query CartVersion($id: String!) {
    cart(id: $id) {
      version
    }
  }
`;

const CREATE_QUOTE_REQUEST_MUTATION = /* GraphQL */ `
  mutation CreateQuoteRequest($draft: QuoteRequestDraft!) {
    createQuoteRequest(draft: $draft) {
      id
      version
      quoteRequestState
    }
  }
`;

function mapAddress(address?: CtAddress | null): CtAddress | undefined {
  return address
    ? {
        additionalAddressInfo: address.additionalAddressInfo ?? undefined,
        additionalStreetInfo: address.additionalStreetInfo ?? undefined,
        apartment: address.apartment ?? undefined,
        building: address.building ?? undefined,
        city: address.city ?? undefined,
        country: address.country ?? undefined,
        mobile: address.mobile ?? undefined,
        pOBox: address.pOBox ?? undefined,
        phone: address.phone ?? undefined,
        postalCode: address.postalCode ?? undefined,
        state: address.state ?? undefined,
        streetName: address.streetName ?? undefined,
        streetNumber: address.streetNumber ?? undefined
      }
    : undefined;
}

function mapLineItem(lineItem: CtLineItem): QuoteLineItemRecord {
  const unitPrice = lineItem.price?.value ?? undefined;
  const totalPrice =
    lineItem.totalPrice ??
    unitPrice ??
    ({
      centAmount: 0,
      currencyCode: "USD",
      fractionDigits: 2
    } satisfies CtMoney);

  return {
    id: lineItem.id,
    name: lineItem.nameAllLocales?.[0]?.value ?? lineItem.variant?.sku ?? lineItem.id,
    productId: lineItem.productId ?? undefined,
    quantity: lineItem.quantity,
    sku: lineItem.variant?.sku ?? undefined,
    totalPrice,
    unitPrice
  };
}

function mapQuoteRequest(row: CtQuoteRequest): QuoteRecord {
  return {
    billingAddress: mapAddress(row.billingAddress),
    businessUnit: row.businessUnit
      ? {
          key: row.businessUnit.key ?? undefined,
          name: row.businessUnit.name ?? undefined
        }
      : undefined,
    comment: row.comment ?? undefined,
    companyKey: row.businessUnit?.key ?? undefined,
    companyName: row.businessUnit?.name ?? row.businessUnit?.key ?? undefined,
    createdAt: row.createdAt,
    customer: row.customer
      ? {
          email: row.customer.email,
          firstName: row.customer.firstName ?? undefined,
          id: row.customer.id,
          lastName: row.customer.lastName ?? undefined
        }
      : undefined,
    customerEmail: row.customer?.email,
    customerId: row.customer?.id,
    id: row.id,
    key: row.key ?? undefined,
    lastModifiedAt: row.lastModifiedAt,
    lineItemCount: row.lineItems?.length ?? 0,
    lineItems: row.lineItems?.map(mapLineItem) ?? [],
    quoteNumber: row.key ?? `#${row.id.slice(0, 8)}`,
    shippingAddress: mapAddress(row.shippingAddress),
    status: row.quoteRequestState ?? "Submitted",
    totalPrice: row.totalPrice ?? undefined
  };
}

async function getCartVersion(cartId: string) {
  const data = await commercetoolsGraphql<CartVersionResponse>(CART_VERSION_QUERY, { id: cartId });
  if (!data.cart) {
    throw new Error(`Cart ${cartId} was not found.`);
  }
  return data.cart.version;
}

export const resolvers = {
  createQuoteRequest: async (_parent: unknown, args: { cartId: string; comment?: string }) => {
    const cartVersion = await getCartVersion(args.cartId);
    const comment = args.comment?.trim();
    const data = await commercetoolsGraphql<CreateQuoteRequestResponse>(CREATE_QUOTE_REQUEST_MUTATION, {
      draft: {
        cart: {
          id: args.cartId,
          typeId: "cart"
        },
        cartVersion,
        ...(comment ? { comment } : {})
      }
    });

    return data.createQuoteRequest;
  },
  quote: async (_parent: unknown, args: { id: string }) => {
    const data = await commercetoolsGraphql<QuoteRequestResponse>(QUOTE_REQUEST_QUERY, { id: args.id });
    return data.quoteRequest ? mapQuoteRequest(data.quoteRequest) : null;
  },
  quotes: async (_parent: unknown, args: QuoteArgs) => {
    const { limit, offset } = paging(args);
    const where = compactWhere([
      args.customerId ? `customer(id="${escapeWhere(args.customerId)}")` : undefined,
      args.companyKey ? `businessUnit(key="${escapeWhere(args.companyKey)}")` : undefined
    ]);

    const data = await commercetoolsGraphql<QuoteRequestsResponse>(QUOTE_REQUESTS_QUERY, {
      limit,
      offset,
      sort: sort(args),
      where
    });

    return page(data.quoteRequests.results.map(mapQuoteRequest), data.quoteRequests.total, data.quoteRequests.offset);
  }
};
