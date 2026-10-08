import { gql } from "@apollo/client";

export const TICKET_FIELDS = gql`
  fragment TicketFields on Ticket {
    id ticketNumber aiStatus customerEmail customerId contactType category orderNumber priority status assignee
    createdBy subject message solution timeSpentOnTicket createdAt lastModifiedAt resolutionDate source
    comments { id comment createdAt status author }
    attachments { name url size }
    history { id ticketNumber operationDate reason solution status priority assignedTo worklog timeSpent }
  }
`;

export const TICKETS_QUERY = gql`
  ${TICKET_FIELDS}
  query TicketsPage($limit: Int!, $offset: Int!) {
    ticketPage(limit: $limit, offset: $offset, sortKey: "lastModifiedAt", sortOrder: "desc") {
      total results { ...TicketFields }
    }
  }
`;
export const CREATE_TICKET = gql`${TICKET_FIELDS} mutation CreateTicket($draft: TicketDraftInput!) { createTicket(draft: $draft) { ...TicketFields } }`;
export const UPDATE_TICKET = gql`${TICKET_FIELDS} mutation UpdateTicket($id: ID!, $patch: TicketUpdateInput!) { updateTicket(id: $id, patch: $patch) { ...TicketFields } }`;
export const ADD_WORKLOG = gql`${TICKET_FIELDS} mutation AddTicketWorklog($id: ID!, $comment: WorklogCommentInput!) { addTicketWorklog(id: $id, comment: $comment) { ...TicketFields } }`;

export const TICKET_QUERY = gql`${TICKET_FIELDS} query TicketDetail($id: ID!) { ticket(id: $id) { ...TicketFields } }`;
export const TICKET_PROVIDER_FIELDS = gql`
  query TicketProviderFields($id: ID!) { ticketProviderFields(id: $id) { id label type value } }
`;
