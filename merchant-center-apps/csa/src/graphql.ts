import gql from 'graphql-tag';

export const DASHBOARD_QUERY = gql`
  query CsaDashboard($activeCartWhere: String!) {
    customers(limit: 1) {
      total
    }
    carts(limit: 1, where: $activeCartWhere) {
      total
    }
    orders(limit: 1) {
      total
    }
    recentOrders: orders(limit: 5, sort: ["createdAt desc"]) {
      results {
        id
        orderNumber
        customerEmail
        orderState
        paymentState
        shipmentState
        createdAt
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`;

export const PRODUCTS_QUERY = gql`
  query CsaProducts($limit: Int!, $offset: Int!, $sort: [String!]) {
    products(limit: $limit, offset: $offset, sort: $sort) {
      total
      count
      offset
      results {
        id
        version
        key
        createdAt
        lastModifiedAt
        productType {
          id
          name
        }
        masterData {
          published
          current {
            nameAllLocales {
              locale
              value
            }
            descriptionAllLocales {
              locale
              value
            }
            masterVariant {
              id
              sku
              prices {
                value {
                  centAmount
                  currencyCode
                  fractionDigits
                }
              }
            }
            allVariants {
              id
              sku
              key
              images {
                url
                label
              }
              prices {
                value {
                  centAmount
                  currencyCode
                  fractionDigits
                }
              }
              availability {
                noChannel {
                  isOnStock
                  availableQuantity
                }
              }
              attributesRaw {
                name
                value
              }
            }
          }
        }
      }
    }
  }
`;

export const PRODUCT_DETAIL_QUERY = gql`
  query CsaProductDetail($id: String!) {
    product(id: $id) {
      id
      version
      key
      createdAt
      lastModifiedAt
      priceMode
      productType {
        id
        name
      }
      taxCategory {
        id
        name
      }
      masterData {
        published
        current {
          nameAllLocales {
            locale
            value
          }
          descriptionAllLocales {
            locale
            value
          }
          categories {
            id
            name(locale: "en")
          }
          allVariants {
            id
            sku
            key
            images {
              url
              label
            }
            prices {
              value {
                centAmount
                currencyCode
                fractionDigits
              }
            }
            availability {
              noChannel {
                isOnStock
                availableQuantity
              }
            }
            attributesRaw {
              name
              value
            }
          }
        }
      }
    }
  }
`;

export const CUSTOMERS_QUERY = gql`
  query CsaCustomers(
    $limit: Int!
    $offset: Int!
    $sort: [String!]
    $where: String
  ) {
    customers(limit: $limit, offset: $offset, sort: $sort, where: $where) {
      total
      count
      offset
      results {
        id
        version
        key
        customerNumber
        email
        firstName
        lastName
        companyName
        isEmailVerified
        createdAt
        lastModifiedAt
        customerGroup {
          id
          name
        }
      }
    }
  }
`;

export const CUSTOMER_DETAIL_QUERY = gql`
  query CsaCustomerDetail($id: String!, $customerWhere: String!) {
    customer(id: $id) {
      id
      version
      key
      customerNumber
      email
      title
      salutation
      firstName
      middleName
      lastName
      companyName
      vatId
      dateOfBirth
      locale
      authenticationMode
      isEmailVerified
      createdAt
      lastModifiedAt
      customerGroup {
        id
        name
      }
      stores {
        key
      }
      addresses {
        id
        firstName
        lastName
        company
        streetName
        streetNumber
        city
        state
        postalCode
        country
        email
        phone
      }
      defaultShippingAddressId
      defaultBillingAddressId
      shippingAddressIds
      billingAddressIds
      custom {
        type {
          key
          name(locale: "en")
        }
        customFieldsRaw {
          name
          value
        }
      }
    }
    customerGroups(limit: 500) {
      total
      results {
        id
        key
        name
      }
    }
    orders(limit: 20, sort: ["createdAt desc"], where: $customerWhere) {
      total
      results {
        id
        orderNumber
        customerEmail
        orderState
        paymentState
        shipmentState
        createdAt
        returnInfo {
          returnTrackingId
          returnDate
          items {
            id
            quantity
            shipmentState
            paymentState
          }
        }
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
    carts(limit: 20, sort: ["lastModifiedAt desc"], where: $customerWhere) {
      total
      results {
        id
        key
        customerEmail
        cartState
        lastModifiedAt
        totalLineItemQuantity
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`;

export const CARTS_QUERY = gql`
  query CsaCarts(
    $limit: Int!
    $offset: Int!
    $sort: [String!]
    $where: String
  ) {
    carts(limit: $limit, offset: $offset, sort: $sort, where: $where) {
      total
      count
      offset
      results {
        id
        version
        key
        customerId
        customerEmail
        cartState
        createdAt
        lastModifiedAt
        totalLineItemQuantity
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`;

export const CART_DETAIL_QUERY = gql`
  query CsaCartDetail($id: String!) {
    cart(id: $id) {
      id
      version
      key
      customerId
      customerEmail
      cartState
      createdAt
      lastModifiedAt
      totalLineItemQuantity
      totalPrice {
        centAmount
        currencyCode
        fractionDigits
      }
      taxedShippingPrice {
        totalNet {
          centAmount
          currencyCode
          fractionDigits
        }
        totalGross {
          centAmount
          currencyCode
          fractionDigits
        }
      }
      shippingAddress {
        firstName
        lastName
        company
        streetName
        streetNumber
        apartment
        building
        additionalStreetInfo
        additionalAddressInfo
        city
        state
        postalCode
        country
        email
        phone
        mobile
      }
      billingAddress {
        firstName
        lastName
        company
        streetName
        streetNumber
        city
        state
        postalCode
        country
        email
        phone
      }
      lineItems {
        id
        productId
        quantity
        name(locale: "en")
        nameAllLocales {
          locale
          value
        }
        variant {
          sku
        }
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
      discountCodes {
        state
        discountCode {
          id
          code
          nameAllLocales {
            locale
            value
          }
        }
      }
      custom {
        customFieldsRaw {
          name
          value
        }
      }
    }
  }
`;

export const CART_CUSTOMER_ADDRESSES_QUERY = gql`
  query CsaCartCustomerAddresses($id: String!) {
    customer(id: $id) {
      id
      addresses {
        id
        firstName
        lastName
        company
        streetName
        streetNumber
        city
        state
        postalCode
        country
        email
        phone
      }
      defaultShippingAddressId
      defaultBillingAddressId
      shippingAddressIds
      billingAddressIds
    }
  }
`;

export const ORDERS_QUERY = gql`
  query CsaOrders(
    $limit: Int!
    $offset: Int!
    $sort: [String!]
    $where: String
  ) {
    orders(limit: $limit, offset: $offset, sort: $sort, where: $where) {
      total
      count
      offset
      results {
        id
        version
        orderNumber
        customerId
        customerEmail
        orderState
        paymentState
        shipmentState
        createdAt
        lastModifiedAt
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`;

export const ORDER_DETAIL_QUERY = gql`
  query CsaOrderDetail($id: String!) {
    order(id: $id) {
      id
      version
      orderNumber
      customerId
      customerEmail
      orderState
      paymentState
      shipmentState
      createdAt
      lastModifiedAt
      totalPrice {
        centAmount
        currencyCode
        fractionDigits
      }
      taxedShippingPrice {
        totalNet {
          centAmount
          currencyCode
          fractionDigits
        }
        totalGross {
          centAmount
          currencyCode
          fractionDigits
        }
      }
      shippingAddress {
        firstName
        lastName
        company
        streetName
        streetNumber
        apartment
        building
        additionalStreetInfo
        additionalAddressInfo
        city
        state
        postalCode
        country
        email
        phone
        mobile
      }
      billingAddress {
        firstName
        lastName
        company
        streetName
        streetNumber
        city
        state
        postalCode
        country
        email
        phone
      }
      lineItems {
        id
        productId
        quantity
        name(locale: "en")
        nameAllLocales {
          locale
          value
        }
        variant {
          sku
        }
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        custom {
          customFieldsRaw {
            name
            value
          }
        }
      }
      shippingInfo {
        shippingMethodName
        shippingMethod {
          id
          name
        }
        shippingMethodState
        price {
          centAmount
          currencyCode
          fractionDigits
        }
        taxRate {
          name
          amount
          includedInPrice
          country
          state
        }
        deliveries {
          id
          createdAt
          items {
            id
            quantity
          }
          address {
            firstName
            lastName
            company
            streetName
            streetNumber
            apartment
            building
            additionalStreetInfo
            additionalAddressInfo
            city
            state
            postalCode
            country
            email
            phone
            mobile
          }
          parcels {
            id
            createdAt
            items {
              id
              quantity
            }
            measurements {
              heightInMillimeter
              lengthInMillimeter
              widthInMillimeter
              weightInGram
            }
            trackingData {
              trackingId
              carrier
              provider
              providerTransaction
              isReturn
            }
          }
        }
      }
      returnInfo {
        returnTrackingId
        returnDate
        items {
          id
          quantity
          shipmentState
          paymentState
          comment
        }
      }
      paymentInfo {
        payments {
          id
          interfaceId
          createdAt
          lastModifiedAt
          amountPlanned {
            centAmount
            currencyCode
            fractionDigits
          }
          paymentMethodInfo {
            paymentInterface
            method
            name(locale: "en")
          }
          paymentStatus {
            interfaceCode
            interfaceText
          }
          transactions {
            id
            timestamp
            type
            state
            interactionId
            amount {
              centAmount
              currencyCode
              fractionDigits
            }
          }
        }
      }
      custom {
        type {
          key
          name(locale: "en")
        }
        customFieldsRaw {
          name
          value
        }
      }
    }
  }
`;

export const RETURNS_QUERY = gql`
  query CsaReturns($limit: Int!, $offset: Int!, $sort: [String!]) {
    orders(
      limit: $limit
      offset: $offset
      sort: $sort
      where: "returnInfo is not empty"
    ) {
      total
      count
      offset
      results {
        id
        orderNumber
        customerEmail
        orderState
        paymentState
        shipmentState
        createdAt
        lastModifiedAt
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        returnInfo {
          returnTrackingId
          returnDate
          items {
            id
            quantity
            shipmentState
            paymentState
            comment
          }
        }
      }
    }
  }
`;

export const TYPES_QUERY = gql`
  query CsaTypeDefinitions($limit: Int!, $offset: Int!, $sort: [String!]) {
    typeDefinitions(limit: $limit, offset: $offset, sort: $sort) {
      total
      count
      offset
      results {
        id
        key
        name(locale: "en")
        resourceTypeIds
        createdAt
        lastModifiedAt
        fieldDefinitions {
          name
          label(locale: "en")
          required
          inputHint
          type {
            name
          }
        }
      }
    }
  }
`;
