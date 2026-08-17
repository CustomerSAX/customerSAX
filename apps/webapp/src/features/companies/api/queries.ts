import { gql } from "@apollo/client";

export const COMPANIES_QUERY = gql`
  query Companies($limit: Int!, $offset: Int!, $searchField: String, $searchText: String, $sortKey: String, $sortOrder: String) {
    companies(
      limit: $limit
      offset: $offset
      searchField: $searchField
      searchText: $searchText
      sortKey: $sortKey
      sortOrder: $sortOrder
    ) {
      total
      count
      offset
      results {
        id
        key
        name
        status
        unitType
        contactEmail
        associateMode
        storeMode
        approvalRuleMode
        createdAt
        lastModifiedAt
        parentUnit {
          id
          key
          name
        }
        addresses {
          id
          key
          streetName
          streetNumber
          city
          state
          postalCode
          country
          company
          email
          phone
        }
        associates {
          id
          customerId
          email
          firstName
          lastName
          roles
        }
      }
    }
  }
`;

export const COMPANY_ACTIVITY_QUERY = gql`
  query CompanyActivity($companyKey: String!, $limit: Int!, $offset: Int!) {
    companyCarts(companyKey: $companyKey, limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
      results {
        id
        key
        customerId
        currencyCode
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        lineItems {
          id
          quantity
        }
      }
    }
    companyOrders(companyKey: $companyKey, limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
      results {
        id
        orderNumber
        customerId
        customerEmail
        orderState
        paymentState
        createdAt
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
    quotes(companyKey: $companyKey, limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
      results {
        id
        key
        quoteNumber
        companyKey
        companyName
        customerId
        customerEmail
        status
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
