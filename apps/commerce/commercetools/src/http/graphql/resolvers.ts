/**
 * The subgraph's resolver map — and a MANUAL ALLOWLIST, not an auto-aggregate.
 *
 * Apollo binds a schema field to a resolver only if that field name appears as
 * a key in the `Query`/`Mutation` objects below. Writing a resolver in a
 * `*.resolvers.ts` file and exporting it from its domain barrel is NOT enough:
 * if you forget to also list it here by name, the field silently never runs.
 * The failure mode looks exactly like a data bug — "Cannot query field X" or a
 * null on a non-nullable field — not like the wiring omission it actually is,
 * so it burns real debugging time every time.
 *
 * => After adding ANY new query/mutation anywhere in this subgraph, add its
 *    field name here (keep each block alphabetical) and confirm it resolves.
 *    See .claude/rules/commercetools.md ("The resolver aggregation trap").
 *
 * Each domain (`cart`, `customer`, `order`, `product`, `agent`) owns its own
 * resolver implementations; this file only maps schema field -> implementation.
 */
import { agent } from "./agent/index.js";
import { cart } from "./cart/index.js";
import { customer } from "./customer/index.js";
import { healthcheckResolvers } from "./healthcheck/healthcheck.resolvers.js";
import { order } from "./order/index.js";
import { product } from "./product/index.js";
import { jsonScalar } from "./shared/json-scalar.js";

const agentResolvers = agent.resolvers;
const cartResolvers = cart.resolvers;
const customerResolvers = customer.resolvers;
const orderResolvers = order.resolvers;
const productResolvers = product.resolvers;

export const resolvers = {
  Json: jsonScalar,
  Mutation: {
    addCartLineItem: cartResolvers.addCartLineItem,
    addCustomerAddress: customerResolvers.addCustomerAddress,
    changeCartLineItemQuantity: cartResolvers.changeCartLineItemQuantity,
    createB2bCart: cartResolvers.createB2bCart,
    createCustomer: customerResolvers.createCustomer,
    placeOrderFromCart: cartResolvers.placeOrderFromCart,
    removeCartLineItem: cartResolvers.removeCartLineItem,
    removeCustomerAddress: customerResolvers.removeCustomerAddress,
    replicateOrder: orderResolvers.replicateOrder,
    setCartShippingMethod: cartResolvers.setCartShippingMethod,
    setDefaultCustomerAddress: customerResolvers.setDefaultCustomerAddress,
    updateCartAddresses: cartResolvers.updateCartAddresses,
    updateCustomer: customerResolvers.updateCustomer,
    updateCustomerAddress: customerResolvers.updateCustomerAddress,
    updateCustomerProfile: customerResolvers.updateCustomerProfile,
    updateOrder: orderResolvers.updateOrder
  },
  Query: {
    ...healthcheckResolvers,
    agentList: agentResolvers.agentList,
    activeCartCount: cartResolvers.activeCartCount,
    b2bCarts: cartResolvers.b2bCarts,
    b2bCustomers: customerResolvers.b2bCustomers,
    b2bOrders: orderResolvers.b2bOrders,
    cart: cartResolvers.cart,
    cartPage: cartResolvers.cartPage,
    carts: cartResolvers.carts,
    customer: customerResolvers.customer,
    customerAddresses: customerResolvers.customerAddresses,
    customerPage: customerResolvers.customerPage,
    customerPromotions: customerResolvers.customerPromotions,
    customerShoppingLists: customerResolvers.customerShoppingLists,
    customers: customerResolvers.customers,
    customersByEmails: customerResolvers.customersByEmails,
    order: orderResolvers.order,
    orderCount: orderResolvers.orderCount,
    orderPage: orderResolvers.orderPage,
    orderPayments: orderResolvers.orderPayments,
    orderReturns: orderResolvers.orderReturns,
    orders: orderResolvers.orders,
    product: productResolvers.product,
    productBySlug: productResolvers.productBySlug,
    productDetail: productResolvers.productDetail,
    productPage: productResolvers.productPage,
    productSearch: productResolvers.productSearch,
    products: productResolvers.products,
    quickSearchProducts: productResolvers.quickSearchProducts,
    searchCarts: cartResolvers.searchCarts,
    searchCustomers: customerResolvers.searchCustomers,
    searchOrders: orderResolvers.searchOrders,
    shippingMethods: cartResolvers.shippingMethods,
    standalonePrices: productResolvers.standalonePrices
  }
};
