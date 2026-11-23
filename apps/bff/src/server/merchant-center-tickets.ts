import express, { type Express, type Request } from "express";
import {
  CLOUD_IDENTIFIERS,
  createSessionAuthVerifier
} from "@commercetools-backend/express";
import { findProjectByKeyAnyClient } from "@csa/mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("bff:merchant-center-tickets");

export const MERCHANT_CENTER_TICKETS_PATH = "/merchant-center/tickets";

type MerchantCenterSession = {
  userId: string;
  projectKey: string;
  userPermissions?: string[];
};

type MerchantCenterRequest = Request & { session?: MerchantCenterSession };

type TicketQueryVariables = {
  search?: string;
  customerEmail?: string;
  customerId?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignee?: string;
  limit: number;
  offset: number;
  sortKey: string;
  sortOrder: "asc" | "desc";
};

type TicketPage = {
  results: Array<Record<string, unknown>>;
  total: number;
  count: number;
  offset: number;
};

type GraphqlResponse = {
  data?: { ticketPage?: TicketPage };
  errors?: Array<{ message?: string }>;
};

const TICKET_SORT_KEYS = new Set([
  "ticketNumber",
  "subject",
  "customerName",
  "status",
  "priority",
  "category",
  "assignee",
  "createdAt",
  "lastModifiedAt"
]);

const TICKET_PAGE_QUERY = `
  query MerchantCenterTicketPage(
    $search: String
    $customerEmail: String
    $customerId: String
    $status: String
    $priority: String
    $category: String
    $assignee: String
    $limit: Int!
    $offset: Int!
    $sortKey: String!
    $sortOrder: String!
  ) {
    ticketPage(
      search: $search
      customerEmail: $customerEmail
      customerId: $customerId
      status: $status
      priority: $priority
      category: $category
      assignee: $assignee
      limit: $limit
      offset: $offset
      sortKey: $sortKey
      sortOrder: $sortOrder
    ) {
      total
      count
      offset
      results {
        id
        ticketNumber
        projectKey
        customerName
        customerEmail
        source
        status
        priority
        category
        subject
        assignee
        createdAt
        lastModifiedAt
        customerId
        contactType
        orderNumber
        createdBy
      }
    }
  }
`;

function stringValue(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Keep the forwarded request bounded and prevent arbitrary Mongo sort fields. */
export function sanitizeTicketQueryPayload(payload: unknown): TicketQueryVariables {
  const input =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const requestedSortKey = stringValue(input.sortKey, 50);

  return {
    search: stringValue(input.search),
    customerEmail: stringValue(input.customerEmail),
    customerId: stringValue(input.customerId, 100),
    status: stringValue(input.status, 50),
    priority: stringValue(input.priority, 50),
    category: stringValue(input.category, 100),
    assignee: stringValue(input.assignee, 100),
    limit: boundedInteger(input.limit, 20, 1, 100),
    offset: boundedInteger(input.offset, 0, 0, 1_000_000),
    sortKey:
      requestedSortKey && TICKET_SORT_KEYS.has(requestedSortKey)
        ? requestedSortKey
        : "lastModifiedAt",
    sortOrder: input.sortOrder === "asc" ? "asc" : "desc"
  };
}

/** The exchange token contains the installed Custom Application permissions. */
export function hasCsaTicketPermission(permissions: string[] | undefined) {
  const normalized = new Set(
    (permissions ?? []).map((permission) =>
      permission.trim().replace(/^can/i, "").toLowerCase()
    )
  );
  return normalized.has("viewcsa") || normalized.has("managecsa");
}

async function loadTicketPage(options: {
  graphqlUrl: string;
  clientId: string;
  projectKey: string;
  variables: TicketQueryVariables;
}): Promise<TicketPage> {
  const response = await fetch(options.graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csa-client-id": options.clientId,
      "x-csa-project-key": options.projectKey,
      "x-csa-user-role": "agent"
    },
    body: JSON.stringify({
      operationName: "MerchantCenterTicketPage",
      query: TICKET_PAGE_QUERY,
      variables: options.variables
    })
  });

  const body = (await response.json().catch(() => ({}))) as GraphqlResponse;
  if (!response.ok || body.errors?.length || !body.data?.ticketPage) {
    const detail = body.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(detail || `Ticket service returned HTTP ${response.status}`);
  }
  return body.data.ticketPage;
}

export function mountMerchantCenterTickets(
  app: Express,
  options: { audience?: string; graphqlUrl: string }
) {
  const audience = options.audience?.trim().replace(/\/$/, "");
  const verifySession = audience
    ? createSessionAuthVerifier<MerchantCenterRequest>({
        audience,
        audiencePolicy: "forward-url-origin",
        issuer: CLOUD_IDENTIFIERS.GCP_US
      })
    : undefined;

  app.post(
    MERCHANT_CENTER_TICKETS_PATH,
    express.json({ limit: "64kb" }),
    async (request, response) => {
      if (!verifySession) {
        response.status(503).json({
          message: "Merchant Center ticket integration is not configured."
        });
        return;
      }

      const merchantCenterRequest = request as MerchantCenterRequest;
      try {
        await verifySession(merchantCenterRequest);
      } catch (error) {
        log.warn("rejected Merchant Center exchange token", {
          reason: error instanceof Error ? error.message : "verification failed"
        });
        response.status(401).json({ message: "Invalid Merchant Center session." });
        return;
      }

      const session = merchantCenterRequest.session;
      if (!session?.projectKey) {
        response.status(401).json({ message: "Merchant Center project is missing." });
        return;
      }
      if (!hasCsaTicketPermission(session.userPermissions)) {
        response.status(403).json({
          message: "ViewCsa permission is required to view tickets."
        });
        return;
      }

      try {
        const project = await findProjectByKeyAnyClient(session.projectKey);
        if (!project || (project.platform && project.platform !== "commercetools")) {
          response.status(404).json({
            message: `No CSA tenant is configured for project ${session.projectKey}.`
          });
          return;
        }

        const ticketPage = await loadTicketPage({
          graphqlUrl: options.graphqlUrl,
          clientId: project.clientId,
          projectKey: session.projectKey,
          variables: sanitizeTicketQueryPayload(merchantCenterRequest.body)
        });
        response.json(ticketPage);
      } catch (error) {
        log.error("Merchant Center ticket lookup failed", error, {
          projectKey: session.projectKey
        });
        response.status(502).json({
          message: "Tickets could not be loaded from the CSA ticket service."
        });
      }
    }
  );
}
