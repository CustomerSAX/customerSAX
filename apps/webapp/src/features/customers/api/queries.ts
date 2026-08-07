import { gql } from "@apollo/client";

export const CUSTOMERS_PAGE_QUERY = gql`
  query CustomersPage($limit: Int!, $offset: Int!, $sortKey: String, $sortOrder: String) {
    customerPage(limit: $limit, offset: $offset, sortKey: $sortKey, sortOrder: $sortOrder) {
      total
      count
      offset
      results {
        id
        key
        version
        customerNumber
        externalId
        firstName
        lastName
        companyName
        email
        createdAt
        lastModifiedAt
        customerGroup {
          id
          key
          name
        }
      }
    }
  }
`;
