/**
 * Formats an order amount in the order's own currency (commercetools
 * `totalPrice.currencyCode`). Never assumes USD: a project priced in AUD
 * showed every total as "$" / USD because the views hardcoded the symbol.
 * If the order genuinely has no currency on record, show the bare amount
 * rather than inventing one.
 */
export function formatOrderMoney(
  amount: number,
  currencyCode?: string | null,
  locale?: string
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "--";
  if (!currencyCode) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}
