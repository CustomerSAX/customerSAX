export interface CatalogFilters {
  productTypes?: string[];
  categoryIds?: string[];
  availability?: string[];
  minPrice?: number;
  maxPrice?: number;
}

export interface CatalogMoney {
  centAmount: number;
  currencyCode: string;
  fractionDigits?: number;
}

type Localized = Array<{ locale?: string; value: string }>;
export interface FilterableProduct {
  productType?: { id?: string; name?: string };
  resolvedPrice?: CatalogMoney | null;
  masterData?: {
    current?: {
      categories?: Array<{ id?: string; nameAllLocales?: Localized }>;
      masterVariant?: { availability?: { noChannel?: { isOnStock?: boolean } | null } };
    };
  };
}

export function catalogAvailability(product: FilterableProduct) {
  const stock =
    product.masterData?.current?.masterVariant?.availability?.noChannel?.isOnStock;
  return stock === true ? "inStock" : stock === false ? "outOfStock" : "unknown";
}

export function matchesCatalogFilters(
  product: FilterableProduct,
  filters: CatalogFilters
) {
  if (
    filters.productTypes?.length &&
    !filters.productTypes.includes(product.productType?.id ?? "")
  )
    return false;
  if (
    filters.categoryIds?.length &&
    !product.masterData?.current?.categories?.some((c) =>
      filters.categoryIds!.includes(c.id ?? "")
    )
  )
    return false;
  if (
    filters.availability?.length &&
    !filters.availability.includes(catalogAvailability(product))
  )
    return false;
  if (filters.minPrice != null || filters.maxPrice != null) {
    if (!product.resolvedPrice) return false;
    const amount =
      product.resolvedPrice.centAmount /
      10 ** (product.resolvedPrice.fractionDigits ?? 2);
    if (filters.minPrice != null && amount < filters.minPrice) return false;
    if (filters.maxPrice != null && amount > filters.maxPrice) return false;
  }
  return true;
}

export function catalogFacets(
  products: FilterableProduct[],
  locale: string,
  currency: string
) {
  const types = new Map<string, { value: string; label: string; count: number }>();
  const categories = new Map<string, { value: string; label: string; count: number }>();
  const availability = { inStock: 0, outOfStock: 0, unknown: 0 };
  const prices: number[] = [];
  const label = (values: Localized = []) =>
    values.find((v) => v.locale?.replace(/-/g, "_") === locale.replace(/-/g, "_"))
      ?.value ??
    values[0]?.value ??
    "";
  for (const product of products) {
    if (product.productType?.id) {
      const { id, name } = product.productType;
      const entry = types.get(id) ?? { value: id, label: name || id, count: 0 };
      entry.count++;
      types.set(id, entry);
    }
    for (const category of product.masterData?.current?.categories ?? []) {
      if (!category.id) continue;
      const entry = categories.get(category.id) ?? {
        value: category.id,
        label: label(category.nameAllLocales) || category.id,
        count: 0
      };
      entry.count++;
      categories.set(category.id, entry);
    }
    availability[catalogAvailability(product)]++;
    if (product.resolvedPrice)
      prices.push(
        product.resolvedPrice.centAmount /
          10 ** (product.resolvedPrice.fractionDigits ?? 2)
      );
  }
  const alphabetical = (a: { label: string }, b: { label: string }) =>
    a.label.localeCompare(b.label);
  return {
    productTypes: [...types.values()].sort(alphabetical),
    categories: [...categories.values()].sort(alphabetical),
    availability,
    price: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      currency
    }
  };
}
