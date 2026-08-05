import { getCommercePlatform } from "./federation.js";

const typeDefs = `#graphql
  type ServiceStatus {
    name: String!
    status: String!
  }

  type Query {
    commercePlatform: String!
    hello: String!
    serviceMap: [ServiceStatus!]!
  }
`;

const coreServices = [
  "Ticketing Service",
  "Customer 360 Service",
  "Order Context Service",
  "Conversation Service",
  "Workflow & SLA Service",
  "Knowledge Service",
  "Audit & Reporting Service",
  "AI Assist Service"
];

const resolvers = {
  Query: {
    commercePlatform: () => getCommercePlatform(),
    hello: () => "Hello from the CSA GraphQL BFF",
    serviceMap: () =>
      coreServices.map((name) => ({
        name,
        status: "online"
      }))
  }
};

export const localSchema = {
  resolvers,
  typeDefs
};
