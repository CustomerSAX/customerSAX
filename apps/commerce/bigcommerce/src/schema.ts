import { commerceTypeDefs } from "@csa/commerce-contract";

export const typeDefs = commerceTypeDefs;

export const resolvers = {
  Query: {
    cart: () => notImplemented(),
    carts: () => notImplemented(),
    commerceProvider: () => "bigcommerce",
    companies: () => notImplemented(),
    company: () => notImplemented(),
    companyCarts: () => notImplemented(),
    companyOrders: () => notImplemented(),
    customer: () => notImplemented(),
    customers: () => notImplemented(),
    order: () => notImplemented(),
    orders: () => notImplemented(),
    product: () => notImplemented(),
    products: () => notImplemented(),
    quotes: () => notImplemented()
  }
};

function notImplemented(): never {
  throw new Error("BigCommerce commerce adapter is not implemented yet.");
}
