import express, { type Express, type Request } from "express";
import { createHash, randomUUID } from "node:crypto";
import {
  CLOUD_IDENTIFIERS,
  createSessionAuthVerifier
} from "@commercetools-backend/express";
import { findProjectByKeyAnyClient } from "@csa/mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("bff:merchant-center-refunds");

export const MERCHANT_CENTER_REFUNDS_PATH = "/merchant-center/refunds";

type MerchantCenterSession = {
  userId: string;
  projectKey: string;
  userPermissions?: string[];
};

type MerchantCenterRequest = Request & { session?: MerchantCenterSession };

type Money = {
  centAmount: number;
  currencyCode: string;
  fractionDigits?: number;
};

type RefundRequest = {
  orderId: string;
  returnItemIds: string[];
  amount: Money;
  reason: string;
  note?: string;
  idempotencyKey: string;
};

type ReturnItem = {
  id: string;
  lineItemId?: string | null;
  quantity: number;
  shipmentState: string;
  paymentState: string;
};

type OrderLineItem = {
  id: string;
  quantity: number;
  totalPrice: Money;
};

type PaymentTransaction = {
  id: string;
  type: string;
  state: string;
  amount: Money;
  interactionId?: string | null;
  interfaceId?: string | null;
};

type Payment = {
  id: string;
  amountPlanned: Money;
  transactions: PaymentTransaction[];
};

type RefundContextResponse = {
  data?: {
    order?: {
      id: string;
      orderNumber?: string | null;
      paymentState?: string | null;
      lineItems: OrderLineItem[];
      returnInfo?: Array<{ items: ReturnItem[] }> | null;
    } | null;
    orderPayments?: {
      order?: {
        id: string;
        paymentInfo?: { payments?: Payment[] | null } | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type RefundRecord = {
  id: string;
  amount: number;
  currency: string;
};

const REFUND_CONTEXT_QUERY = `
  query MerchantCenterRefundContext($id: ID!) {
    order(id: $id) {
      id
      orderNumber
      paymentState
      lineItems { id quantity totalPrice { centAmount currencyCode fractionDigits } }
      returnInfo {
        items { id lineItemId quantity shipmentState paymentState }
      }
    }
    orderPayments(id: $id)
  }
`;

const UPDATE_PAYMENT_MUTATION = `
  mutation MerchantCenterRecordRefund($id: ID!, $actions: Json!) {
    updatePayment(id: $id, actions: $actions)
  }
`;

const UPDATE_ORDER_MUTATION = `
  mutation MerchantCenterCompleteRefund($id: ID!, $actions: Json!) {
    updateOrder(id: $id, actions: $actions)
  }
`;

function stringValue(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

export function sanitizeRefundPayload(payload: unknown): RefundRequest | undefined {
  const input =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const amountInput =
    input.amount && typeof input.amount === "object"
      ? (input.amount as Record<string, unknown>)
      : {};
  const orderId = stringValue(input.orderId, 100);
  const reason = stringValue(input.reason, 100);
  const idempotencyKey = stringValue(input.idempotencyKey, 200);
  const currencyCode = stringValue(amountInput.currencyCode, 3)?.toUpperCase();
  const centAmount = amountInput.centAmount;
  const returnItemIds = Array.isArray(input.returnItemIds)
    ? Array.from(
        new Set(
          input.returnItemIds.map((value) => stringValue(value, 100)).filter(isString)
        )
      ).slice(0, 100)
    : [];

  if (
    !orderId ||
    !reason ||
    !idempotencyKey ||
    !currencyCode ||
    currencyCode.length !== 3 ||
    typeof centAmount !== "number" ||
    !Number.isSafeInteger(centAmount) ||
    centAmount <= 0 ||
    returnItemIds.length === 0
  ) {
    return undefined;
  }

  return {
    orderId,
    returnItemIds,
    amount: {
      centAmount,
      currencyCode,
      fractionDigits: 2
    },
    reason,
    note: stringValue(input.note, 500),
    idempotencyKey
  };
}

export function refundFingerprint(refund: RefundRequest) {
  const source = JSON.stringify({
    idempotencyKey: refund.idempotencyKey,
    orderId: refund.orderId,
    returnItemIds: [...refund.returnItemIds].sort(),
    centAmount: refund.amount.centAmount,
    currencyCode: refund.amount.currencyCode
  });
  return `csa-refund-${createHash("sha256").update(source).digest("hex")}`;
}

export function createRefundRecord(amount: Money): RefundRecord {
  return {
    id: `csa_refund_${randomUUID().replaceAll("-", "")}`,
    amount: amount.centAmount,
    currency: amount.currencyCode.toLowerCase()
  };
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

/** The exchange token contains the installed Custom Application permissions. */
export function hasCsaRefundPermission(permissions: string[] | undefined) {
  const normalized = new Set(
    (permissions ?? []).map((permission) =>
      permission.trim().replace(/^can/i, "").toLowerCase()
    )
  );
  return normalized.has("managecsa") || normalized.has("managecsaorders");
}

function transactionTotal(payment: Payment, type: string) {
  return payment.transactions
    .filter((transaction) => transaction.type === type && transaction.state === "Success")
    .reduce((total, transaction) => total + transaction.amount.centAmount, 0);
}

function refundableAmount(payment: Payment) {
  const charged = transactionTotal(payment, "Charge");
  const refunded = transactionTotal(payment, "Refund");
  return Math.max(0, (charged || payment.amountPlanned.centAmount) - refunded);
}

export function selectedReturnMaximum(
  lineItems: OrderLineItem[],
  returnItems: ReturnItem[]
) {
  return returnItems.reduce((total, returnItem) => {
    const lineItem = lineItems.find(
      (item) => item.id === (returnItem.lineItemId ?? returnItem.id)
    );
    if (!lineItem || lineItem.quantity <= 0) return total;
    return (
      total +
      Math.round(
        (lineItem.totalPrice.centAmount / lineItem.quantity) * returnItem.quantity
      )
    );
  }, 0);
}

async function postGraphql(options: {
  graphqlUrl: string;
  clientId: string;
  projectKey: string;
  query: string;
  variables: Record<string, unknown>;
}) {
  const response = await fetch(options.graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csa-client-id": options.clientId,
      "x-csa-project-key": options.projectKey,
      "x-csa-user-role": "agent"
    },
    body: JSON.stringify({ query: options.query, variables: options.variables })
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string }>;
  };
  if (!response.ok || body.errors?.length) {
    const detail = body.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(detail || `CSA commerce service returned HTTP ${response.status}`);
  }
  return body;
}

export function mountMerchantCenterRefunds(
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
    MERCHANT_CENTER_REFUNDS_PATH,
    express.json({ limit: "32kb" }),
    async (request, response) => {
      if (!verifySession) {
        response
          .status(503)
          .json({ message: "Merchant Center refund integration is not configured." });
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
      if (!hasCsaRefundPermission(session.userPermissions)) {
        response
          .status(403)
          .json({ message: "ManageCsaOrders permission is required to issue refunds." });
        return;
      }

      const refundRequest = sanitizeRefundPayload(merchantCenterRequest.body);
      if (!refundRequest) {
        response
          .status(400)
          .json({ message: "The refund request is incomplete or invalid." });
        return;
      }

      try {
        const requestFingerprint = refundFingerprint(refundRequest);
        const project = await findProjectByKeyAnyClient(session.projectKey);
        if (!project || (project.platform && project.platform !== "commercetools")) {
          response.status(404).json({
            message: `No CSA commercetools tenant is configured for ${session.projectKey}.`
          });
          return;
        }

        const contextBody = (await postGraphql({
          graphqlUrl: options.graphqlUrl,
          clientId: project.clientId,
          projectKey: session.projectKey,
          query: REFUND_CONTEXT_QUERY,
          variables: { id: refundRequest.orderId }
        })) as RefundContextResponse;
        const order = contextBody.data?.order;
        const payments =
          contextBody.data?.orderPayments?.order?.paymentInfo?.payments ?? [];
        if (!order) {
          response.status(404).json({ message: "Order not found." });
          return;
        }

        const returnItems = (order.returnInfo ?? []).flatMap((entry) => entry.items);
        const selectedReturnItems = refundRequest.returnItemIds.map((id) =>
          returnItems.find((item) => item.id === id)
        );
        if (selectedReturnItems.some((item) => !item)) {
          response.status(409).json({
            message: "One or more return items are no longer present on this order."
          });
          return;
        }
        if (selectedReturnItems.some((item) => item?.shipmentState !== "Returned")) {
          response
            .status(409)
            .json({ message: "Only items marked as returned can be refunded." });
          return;
        }

        const recordedRefund = payments
          .flatMap((candidate) =>
            candidate.transactions.map((transaction) => ({
              payment: candidate,
              transaction
            }))
          )
          .find(
            ({ transaction }) =>
              transaction.type === "Refund" &&
              transaction.interfaceId === requestFingerprint
          );
        if (recordedRefund) {
          const { payment: recordedPayment, transaction } = recordedRefund;
          if (
            transaction.amount.centAmount !== refundRequest.amount.centAmount ||
            transaction.amount.currencyCode !== refundRequest.amount.currencyCode
          ) {
            response.status(409).json({
              message:
                "This refund idempotency key was already used for a different amount."
            });
            return;
          }
          if (transaction.state === "Success") {
            const outstandingIds = selectedReturnItems
              .filter((item) => item?.paymentState !== "Refunded")
              .map((item) => item?.id)
              .filter((id): id is string => Boolean(id));
            if (outstandingIds.length > 0) {
              const noPaymentBalanceRemains = payments.every(
                (candidate) => refundableAmount(candidate) === 0
              );
              await postGraphql({
                graphqlUrl: options.graphqlUrl,
                clientId: project.clientId,
                projectKey: session.projectKey,
                query: UPDATE_ORDER_MUTATION,
                variables: {
                  id: order.id,
                  actions: [
                    ...outstandingIds.map((returnItemId) => ({
                      setReturnPaymentState: { returnItemId, paymentState: "Refunded" }
                    })),
                    ...(noPaymentBalanceRemains
                      ? [{ changePaymentState: { paymentState: "Refunded" } }]
                      : [])
                  ]
                }
              });
            }
          }
          const providerRefundId = transaction.interactionId ?? "unavailable";
          if (transaction.state === "Failure") {
            response.status(422).json({
              message: `Refund ${providerRefundId} previously failed. Start a new refund attempt.`,
              provider: "commercetools",
              providerRefundId,
              status: "failed"
            });
            return;
          }
          response.status(transaction.state === "Pending" ? 202 : 200).json({
            provider: "commercetools",
            providerRefundId,
            status: transaction.state === "Pending" ? "pending" : "recorded",
            transactionState: transaction.state,
            amount: transaction.amount,
            orderId: order.id,
            paymentId: recordedPayment.id
          });
          return;
        }

        if (selectedReturnItems.some((item) => item?.paymentState === "Refunded")) {
          response
            .status(409)
            .json({ message: "One or more selected return items are already refunded." });
          return;
        }
        const selectedItems = selectedReturnItems.filter((item): item is ReturnItem =>
          Boolean(item)
        );
        const selectedMaximum = selectedReturnMaximum(order.lineItems, selectedItems);
        if (selectedMaximum <= 0 || refundRequest.amount.centAmount > selectedMaximum) {
          response.status(409).json({
            message: `Refund amount exceeds the selected return-item value (${selectedMaximum} ${refundRequest.amount.currencyCode} minor units).`
          });
          return;
        }

        const payment = payments.sort(
          (left, right) => refundableAmount(right) - refundableAmount(left)
        )[0];
        if (
          payment &&
          payment.amountPlanned.currencyCode !== refundRequest.amount.currencyCode
        ) {
          response
            .status(400)
            .json({ message: "Refund currency does not match the linked payment." });
          return;
        }
        const remaining = payment ? refundableAmount(payment) : undefined;
        if (remaining !== undefined && refundRequest.amount.centAmount > remaining) {
          response.status(409).json({
            message: `Refund amount exceeds the remaining refundable amount (${remaining} ${refundRequest.amount.currencyCode} minor units).`
          });
          return;
        }

        const providerRefund = createRefundRecord(refundRequest.amount);
        const transactionState = "Success";
        const alreadyRecorded = payment?.transactions.some(
          (transaction) =>
            transaction.type === "Refund" &&
            (transaction.interactionId === providerRefund.id ||
              transaction.interfaceId === requestFingerprint)
        );
        const recordedWithDifferentRequest = payment?.transactions.some(
          (transaction) =>
            transaction.type === "Refund" &&
            transaction.interactionId === providerRefund.id &&
            transaction.interfaceId !== requestFingerprint
        );
        if (recordedWithDifferentRequest) {
          response.status(409).json({
            message:
              "This provider refund was already recorded for different return items."
          });
          return;
        }

        if (payment && !alreadyRecorded) {
          await postGraphql({
            graphqlUrl: options.graphqlUrl,
            clientId: project.clientId,
            projectKey: session.projectKey,
            query: UPDATE_PAYMENT_MUTATION,
            variables: {
              id: payment.id,
              actions: [
                {
                  addTransaction: {
                    transaction: {
                      timestamp: new Date().toISOString(),
                      type: "Refund",
                      amount: refundRequest.amount,
                      state: transactionState,
                      interactionId: providerRefund.id,
                      interfaceId: requestFingerprint
                    }
                  }
                }
              ]
            }
          });
        }

        const totalOrderRemaining = payments.reduce(
          (total, candidate) => total + refundableAmount(candidate),
          0
        );
        const fullyRefunded =
          Boolean(payment) && refundRequest.amount.centAmount === totalOrderRemaining;
        await postGraphql({
          graphqlUrl: options.graphqlUrl,
          clientId: project.clientId,
          projectKey: session.projectKey,
          query: UPDATE_ORDER_MUTATION,
          variables: {
            id: order.id,
            actions: [
              ...refundRequest.returnItemIds.map((returnItemId) => ({
                setReturnPaymentState: { returnItemId, paymentState: "Refunded" }
              })),
              ...(fullyRefunded
                ? [{ changePaymentState: { paymentState: "Refunded" } }]
                : [])
            ]
          }
        });

        log.info("Merchant Center refund processed", {
          projectKey: session.projectKey,
          orderId: order.id,
          paymentId: payment?.id,
          provider: "commercetools",
          providerRefundId: providerRefund.id,
          providerStatus: "recorded",
          centAmount: refundRequest.amount.centAmount,
          currencyCode: refundRequest.amount.currencyCode,
          returnItemCount: refundRequest.returnItemIds.length,
          userId: session.userId
        });
        response.status(200).json({
          provider: "commercetools",
          providerRefundId: providerRefund.id,
          status: "recorded",
          transactionState,
          amount: refundRequest.amount,
          orderId: order.id,
          paymentId: payment?.id ?? null
        });
      } catch (error) {
        log.error("Merchant Center refund failed", error, {
          projectKey: session.projectKey,
          orderId: refundRequest.orderId,
          userId: session.userId
        });
        response.status(502).json({
          message:
            error instanceof Error ? error.message : "The refund could not be processed."
        });
      }
    }
  );
}
