import { gql } from "graphql-tag";

/**
 * Agent registry — CSA agents stored as CommerceTools custom objects
 * (container: "mc-user-info"). Used by the ticket assignment picker and
 * the AI assistant's list_assignees tool.
 */
export const agentTypeDefs = gql`
  type AgentUser {
    id: ID!
    key: String!
    email: String!
  }

  type AgentListResult {
    results: [AgentUser!]!
    total: Int!
  }

  extend type Query {
    """
    Returns all CSA agents registered in the given CommerceTools custom-object
    container (default: "mc-user-info"). Mirrors the FETCH_USERS_LIST query
    used in the standalone reference implementation.
    """
    agentList(container: String): AgentListResult!
  }
`;
