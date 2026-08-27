/**
 * Product Module Utilities
 *
 * Pure functions for formatting, mapping, and transforming product data.
 * All business logic kept here, out of UI components and hooks.
 */

import type {
  CtMoneyValue,
  CtVariantAvailability,
  CtRawProduct,
  CtRawVariant,
  CtRawCategory,
  CtLocalizedString,
  ProductListRow,
  ProductVariantRow,
  VariantDetailRow,
  CategoryBreadcrumb,
  ProductDetail,
  StandalonePriceResult,
} from "../types/product-types";
import { formatDate } from "@/lib/format-date";

// ---------------------------------------------------------------------------
// Money formatting
// ---------------------------------------------------------------------------

/** Formats a CT money value (centAmount + currency) for display. */
export function formatMoneyValue(value: CtMoneyValue | null | undefined): string {
  if (!value || typeof value.centAmount !== "number") return "--";
  const fractionDigits =
    typeof value.fractionDigits === "number" ? value.fractionDigits : 2;
  const amount = value.centAmount / 10 ** fractionDigits;
  const currency =
    typeof value.currencyCode === "string" ? value.currencyCode : "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(fractionDigits)} ${currency}`.trim();
  }
}

/** Formats a variant embedded price object for display. */
export function formatPrice(
  price: { value?: CtMoneyValue } | null | undefined
): string {
  return formatMoneyValue(price?.value);
}

/** Formats a centAmount with fractionDigits as $X.XX */
export function amountStr(
  centAmount?: number,
  fractionDigits?: number
): string {
  if (centAmount == null) return "--";
  return "$" + (centAmount / 100).toFixed(fractionDigits ?? 2);
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/**
 * Derives a stock label from CT availability.
 * Prefers noChannel; falls back to per-channel check.
 */
export function deriveAvailability(
  availability: CtVariantAvailability | null | undefined
): string {
  if (!availability) return "--";
  const { noChannel } = availability;
  if (noChannel) {
    return noChannel.isOnStock ? "In stock" : "Out of stock";
  }
  const channels = availability.channels?.results;
  if (Array.isArray(channels) && channels.length > 0) {
    return channels.some((c) => c?.availability?.isOnStock)
      ? "In stock"
      : "Out of stock";
  }
  return "--";
}

/**
 * Resolves available quantity from CT variant availability.
 * Prefers noChannel; sums across supply channels as fallback.
 */
export function availableQuantity(
  availability: CtVariantAvailability | undefined
): string {
  const noChannelQty = availability?.noChannel?.availableQuantity;
  if (noChannelQty != null) return String(noChannelQty);

  const channelResults = availability?.channels?.results ?? [];
  if (channelResults.length === 0) return "--";

  const quantities = channelResults
    .map((r) => r?.availability?.availableQuantity)
    .filter((qty): qty is number => typeof qty === "number");
  if (quantities.length === 0) return "--";

  return String(quantities.reduce((sum, qty) => sum + qty, 0));
}

// ---------------------------------------------------------------------------
// Localization
// ---------------------------------------------------------------------------

/** Returns the first value from a LocalizedString array, optionally for a locale. */
export function firstLocalized(
  values: CtLocalizedString[] | undefined,
  locale?: string
): string {
  if (!values || values.length === 0) return "";
  if (locale) {
    const match = values.find(
      (v) => v.locale?.toLowerCase() === locale.toLowerCase()
    );
    if (match?.value) return match.value;
    // Fall back to en or first
    const en = values.find((v) => v.locale?.startsWith("en"));
    if (en?.value) return en.value;
  }
  return values[0]?.value ?? "";
}

// ---------------------------------------------------------------------------
// Standalone prices
// ---------------------------------------------------------------------------

/** Picks the lowest USD price per SKU from standalone price results. */
export function lowestPriceBySku(
  results: StandalonePriceResult[]
): Map<string, CtMoneyValue> {
  const map = new Map<string, CtMoneyValue>();
  for (const row of results) {
    const value = row?.value;
    if (!row?.sku || !value || typeof value.centAmount !== "number") continue;
    if (value.currencyCode && value.currencyCode !== "USD") continue;
    const prev = map.get(row.sku);
    if (
      !prev ||
      (typeof prev.centAmount === "number" &&
        value.centAmount < prev.centAmount)
    ) {
      map.set(row.sku, value);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Sorting (browse mode column key → CT sort field)
// ---------------------------------------------------------------------------

/** Maps a product list column key to a CT products() sort field. */
export function browseSortField(sortKey: string): string | null {
  switch (sortKey) {
    case "itemName":
      return "masterData.current.name.en";
    case "key":
      return "key";
    case "created":
      return "createdAt";
    case "modified":
      return "lastModifiedAt";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

/** Maps a raw CT product node from productSearch into a ProductListRow. */
export function mapRawToListRow(p: CtRawProduct): ProductListRow {
  const current = p.masterData?.current;
  const name = firstLocalized(current?.nameAllLocales) || "--";
  const description = firstLocalized(current?.descriptionAllLocales) || "--";

  const allVariants: CtRawVariant[] = current?.allVariants ?? [];
  const masterVariant = current?.masterVariant;

  const categoryNames = (current?.categories ?? [])
    .map((c) => firstLocalized(c.nameAllLocales))
    .filter((n): n is string => n.length > 0);

  const sku = masterVariant?.sku ?? "--";

  return {
    id: p.id,
    itemName: name,
    productType: p.productType?.name ?? "--",
    key: p.key ?? "--",
    sku,
    price: formatPrice(masterVariant?.prices?.[0]),
    availability: deriveAvailability(masterVariant?.availability),
    description,
    categories: categoryNames.length > 0 ? categoryNames.join(", ") : "--",
    status: p.masterData?.hasStagedChanges ? "Modified" : "Published",
    created: formatDate(p.createdAt),
    modified: formatDate(p.lastModifiedAt),
    variants: allVariants.map(
      (v): ProductVariantRow => ({
        id: v?.id != null ? String(v.id) : "--",
        sku: v?.sku ?? "--",
        key: v?.key ?? "--",
      })
    ),
    variantCount: allVariants.length,
  };
}

/** Maps a raw CT category node into a CategoryBreadcrumb. */
export function mapCategory(c: CtRawCategory): CategoryBreadcrumb {
  const name = firstLocalized(c.nameAllLocales) || "--";
  const ancestors = (c.ancestors ?? [])
    .map((a) => firstLocalized(a.nameAllLocales))
    .filter((n): n is string => n.length > 0);
  return { id: c.id ?? "", name, ancestors };
}

/** Maps a raw CT product node from productDetail into a normalized ProductDetail. */
export function mapRawToDetail(p: CtRawProduct): ProductDetail {
  const current = p.masterData?.current;
  const productName = firstLocalized(current?.nameAllLocales) || "--";
  const productDescription =
    firstLocalized(current?.descriptionAllLocales) || "--";

  const categories: CategoryBreadcrumb[] = (
    current?.categories ?? []
  ).map(mapCategory);

  const rawVariants = [
    ...(current?.masterVariant ? [current.masterVariant] : []),
    ...(current?.allVariants ?? []),
  ];
  const uniqueVariants = rawVariants.filter(
    (v, i, arr) => arr.findIndex((x) => (x.sku && x.sku === v.sku) || (x.id && x.id === v.id)) === i
  );

  const variants: VariantDetailRow[] = uniqueVariants.map(
    (v, i): VariantDetailRow => ({
      id: String(v.id ?? i + 1),
      sku: v.sku ?? "--",
      key: v.key ?? "--",
      imageUrl: v.images?.[0]?.url ?? "",
      images: v.images?.map(img => img.url ?? "").filter(Boolean) ?? [],
      unitPrice: amountStr(
        v.prices?.[0]?.value?.centAmount,
        v.prices?.[0]?.value?.fractionDigits
      ),
      quantity: availableQuantity(v.availability),
    })
  );

  return {
    id: p.id,
    key: p.key ?? "--",
    productName,
    productDescription,
    priceMode: p.priceMode ?? "--",
    taxCategory: p.taxCategory?.name ?? "--",
    categories,
    variants,
  };
}
