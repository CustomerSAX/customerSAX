import express, { type Express, type Request } from "express";
import {
  CLOUD_IDENTIFIERS,
  createSessionAuthVerifier
} from "@commercetools-backend/express";
import { findProjectByKeyAnyClient } from "@csa/mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("bff:merchant-center-replacements");

export const MERCHANT_CENTER_REPLACEMENTS_PATH = "/merchant-center/replacements";

type MerchantCenterSession = {
  userId: string;
  projectKey: string;
  userPermissions?: string[];
};

type MerchantCenterRequest = Request & { session?: MerchantCenterSession };

export type ReplacementRequest = {
  orderId: string;
  returnItemId: string;
  replacementSku: string;
  quantity: number;
  reason: string;
  note?: string;
};

function stringValue(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

export function sanitizeReplacementPayload(
  payload: unknown
): ReplacementRequest | undefined {
  const input =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const orderId = stringValue(input.orderId, 100);
  const returnItemId = stringValue(input.returnItemId, 100);
  const replacementSku = stringValue(input.replacementSku, 256);
  const reason = stringValue(input.reason, 100);
  const quantity = input.quantity;

  if (
    !orderId ||
    !returnItemId ||
    !replacementSku ||
    !reason ||
    typeof quantity !== "number" ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    return undefined;
  }

  return {
    orderId,
    returnItemId,
    replacementSku,
    quantity,
    reason,
    note: stringValue(input.note, 500)
  };
}

/** The exchange token contains the installed Custom Application permissions. */
export function hasCsaReplacementPermission(permissions: string[] | undefined) {
  const normalized = new Set(
    (permissions ?? []).map((permission) =>
      permission.trim().replace(/^can/i, "").toLowerCase()
    )
  );
  return normalized.has("managecsa") || normalized.has("managecsaorders");
}

const CREATE_REPLACEMENT_MUTATION = `
  mutation MerchantCenterCreateReplacement($input: Json!) {
    createReplacementOrder(input: $input)
  }
`;

async function createReplacement(options: {
  graphqlUrl: string;
  clientId: string;
  projectKey: string;
  input: ReplacementRequest;
}) {
  const response = await fetch(options.graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csa-client-id": options.clientId,
      "x-csa-project-key": options.projectKey,
      "x-csa-user-role": "agent"
    },
    body: JSON.stringify({
      query: CREATE_REPLACEMENT_MUTATION,
      variables: { input: options.input }
    })
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: { createReplacementOrder?: unknown };
    errors?: Array<{ message?: string }>;
  };
  if (!response.ok || body.errors?.length) {
    const detail = body.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(detail || `CSA commerce service returned HTTP ${response.status}`);
  }
  if (!body.data?.createReplacementOrder) {
    throw new Error("CSA commerce service returned an empty replacement response.");
  }
  return body.data.createReplacementOrder;
}

export function mountMerchantCenterReplacements(
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
    MERCHANT_CENTER_REPLACEMENTS_PATH,
    express.json({ limit: "32kb" }),
    async (request, response) => {
      if (!verifySession) {
        response.status(503).json({
          message: "Merchant Center replacement integration is not configured."
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
      if (!hasCsaReplacementPermission(session.userPermissions)) {
        response.status(403).json({
          message: "ManageCsaOrders permission is required to create replacements."
        });
        return;
      }

      const replacementRequest = sanitizeReplacementPayload(
        merchantCenterRequest.body
      );
      if (!replacementRequest) {
        response.status(400).json({
          message: "The replacement request is incomplete or invalid."
        });
        return;
      }

      try {
        const project = await findProjectByKeyAnyClient(session.projectKey);
        if (!project || (project.platform && project.platform !== "commercetools")) {
          response.status(404).json({
            message: `No CSA commercetools tenant is configured for ${session.projectKey}.`
          });
          return;
        }

        const result = await createReplacement({
          graphqlUrl: options.graphqlUrl,
          clientId: project.clientId,
          projectKey: session.projectKey,
          input: replacementRequest
        });
        log.info("Merchant Center replacement order processed", {
          projectKey: session.projectKey,
          orderId: replacementRequest.orderId,
          returnItemId: replacementRequest.returnItemId,
          replacementSku: replacementRequest.replacementSku,
          quantity: replacementRequest.quantity,
          userId: session.userId
        });
        response.status(200).json(result);
      } catch (error) {
        log.error("Merchant Center replacement failed", error, {
          projectKey: session.projectKey,
          orderId: replacementRequest.orderId,
          returnItemId: replacementRequest.returnItemId,
          userId: session.userId
        });
        response.status(502).json({
          message:
            error instanceof Error
              ? error.message
              : "The replacement order could not be created."
        });
      }
    }
  );
}
