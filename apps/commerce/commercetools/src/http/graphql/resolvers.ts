import { cart } from "./cart/index.js";
import { customer } from "./customer/index.js";
import { healthcheckResolvers } from "./healthcheck/healthcheck.resolvers.js";
import { order } from "./order/index.js";
import { product } from "./product/index.js";
import { jsonScalar } from "./shared/json-scalar.js";

const cartResolvers = cart.resolvers;
const customerResolvers = customer.resolvers;
const orderResolvers = order.resolvers;
const productResolvers = product.resolvers;

export const resolvers = {
  Json: jsonScalar,
  Mutation: {
    addCartLineItem: cartResolvers.addCartLineItem,
    addCustomerAddress: customerResolvers.addCustomerAddress,
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
