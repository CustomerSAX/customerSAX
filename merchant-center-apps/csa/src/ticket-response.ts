type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const isTicket = (value: unknown): value is UnknownRecord => {
  const record = asRecord(value);
  return Boolean(
    record &&
      typeof record.id === 'string' &&
      typeof record.ticketNumber === 'string'
  );
};

/**
 * Accept the direct BFF response, common JSON envelopes, and the legacy list
 * response returned by BFF deployments that predate the detail operation.
 */
export const ticketFromDetailResponse = (
  response: unknown,
  ticketId: string
): UnknownRecord | undefined => {
  const root = asRecord(response);
  const data = asRecord(root?.data);
  const body = asRecord(root?.body);
  const candidates = [
    root,
    root?.ticket,
    data,
    data?.ticket,
    body,
    body?.ticket,
  ];

  const directTicket = candidates.find(isTicket);
  if (directTicket) return directTicket;

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (!Array.isArray(record?.results)) continue;

    const ticket = record.results.find(
      (item) =>
        isTicket(item) &&
        (item.id === ticketId || item.ticketNumber === ticketId)
    );
    if (isTicket(ticket)) return ticket;
  }

  return undefined;
};
