import { gql } from "@apollo/client";

export const SUBSCRIPTION_FIELDS = gql`
  fragment SubscriptionFields on Subscription {
    id subscriptionNumber ownerType customerId customerName customerEmail createdBy businessAccountName
    status frequency startDate scheduleTime nextDeliveryDate endDate shippingAddress paymentMethod currencyCode
    discountLabel priceOverride cancellationReason lastOrderNumber linkedOrderNumbers createdAt updatedAt
    lineItems { id sku name quantity unitPrice }
    history { id action actor createdAt note }
  }
`;

export const SUBSCRIPTIONS_QUERY = gql`
  ${SUBSCRIPTION_FIELDS}
  query Subscriptions($customerId: String) {
    subscriptions(customerId: $customerId) { ...SubscriptionFields }
  }
`;

export const CREATE_SUBSCRIPTION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation CreateSubscription($draft: SubscriptionDraftInput!) {
    createSubscription(draft: $draft) { ...SubscriptionFields }
  }
`;

export const UPDATE_SUBSCRIPTION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation UpdateSubscription($id: ID!, $patch: SubscriptionUpdateInput!) {
    updateSubscription(id: $id, patch: $patch) { ...SubscriptionFields }
  }
`;

export const CHANGE_SUBSCRIPTION_STATUS = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation ChangeSubscriptionStatus($id: ID!, $status: String!, $note: String) {
    changeSubscriptionStatus(id: $id, status: $status, note: $note) { ...SubscriptionFields }
  }
`;

export const SKIP_SUBSCRIPTION_CYCLE = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation SkipSubscriptionCycle($id: ID!) {
    skipSubscriptionCycle(id: $id) { ...SubscriptionFields }
  }
`;

export const DELETE_SUBSCRIPTION_DRAFT = gql`
  mutation DeleteSubscriptionDraft($id: ID!) {
    deleteSubscriptionDraft(id: $id)
  }
`;
