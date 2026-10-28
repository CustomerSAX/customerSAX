import { gql } from "@apollo/client";

export const GET_CUSTOMER_BY_EMAIL_OR_ID = gql`
  query GetCustomerForInvestigation($id: ID, $email: String) {
    customer(id: $id, email: $email) {
      id
      version
      firstName
      lastName
      email
      companyName
    }
  }
`;

export const GET_CUSTOMER_CONTACT_TARGETS = gql`
  query GetCustomerContactTargets($id: ID!) {
    customerContactTargets(id: $id)
  }
`;

export const UPDATE_CUSTOMER_CONTACT_NUMBER = gql`
  mutation UpdateCustomerContactNumber(
    $id: ID!
    $addressId: ID!
    $expectedVersion: Int!
    $phone: String!
  ) {
    updateCustomerContactNumber(
      id: $id
      addressId: $addressId
      expectedVersion: $expectedVersion
      phone: $phone
    )
  }
`;
