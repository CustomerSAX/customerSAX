import { gql } from "@apollo/client";

export const GATEWAY_STATUS_QUERY = gql`
  query GatewayStatus {
    hello
    serviceMap {
      name
      status
    }
  }
`;

