export type ReplacementApiResponse = {
  status: 'created' | 'existing';
  reference: string;
  originalOrderId: string;
  originalOrderNumber?: string | null;
  returnItemId: string;
  replacementOrderId: string;
  replacementOrderNumber?: string | null;
  replacementSku: string;
  quantity: number;
};

export const replacementReference = (orderId: string, returnItemId: string) =>
  `CSA-RPL:${orderId}:${returnItemId}`;

export const parseReplacementQuantity = (
  value: string,
  maximum: number
): number | undefined => {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const quantity = Number(normalized);
  return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= maximum
    ? quantity
    : undefined;
};
