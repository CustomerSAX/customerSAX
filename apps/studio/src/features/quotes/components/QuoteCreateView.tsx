"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { DEFAULT_LOCALE, isSupportedLocale, toCommerceLocale } from "@csa/i18n";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@csa/ui";
import { useCompanies } from "@/features/companies/hooks/use-companies";
import { useEmployees } from "@/features/employees/hooks/use-employees";
import type { QuoteLineItem } from "../types/quote-types";
import type { CompanyAddress } from "@/features/companies/types/company-types";
import type { EmployeeAddress } from "@/features/employees/types/employee-types";
import { localizePathname } from "@/i18n/routing";

interface ProductSearchHit {
  sku: string;
  name: string;
  price: number;
  taxCategoryName?: string | null;
}

type ProductSearchResponse = {
  results?: Array<{
    id?: string;
    key?: string;
    sku?: string;
    name?: string;
    price?: number | string;
    inStock?: boolean;
    taxCategory?: { name?: string | null } | null;
    masterData?: {
      current?: {
        nameAllLocales?: Array<{ locale?: string; value?: string }>;
        allVariants?: Array<{ sku?: string }>;
        masterVariant?: {
          sku?: string;
          prices?: Array<{ value?: { centAmount?: number; fractionDigits?: number } }>;
        };
      };
    };
    nameAllLocales?: Array<{ locale?: string; value?: string }>;
  }>;
};

type QuoteAddress = {
  streetName: string;
  streetNumber?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

type AuthoredQuoteLineItem = {
  id: string;
  name: string;
  quantity: string;
  sku: string;
  unitPrice: string;
};

function quoteAddressFrom(address?: EmployeeAddress | CompanyAddress | QuoteAddress | null): QuoteAddress | null {
  if (!address?.streetName || !address.city || !address.postalCode || !address.country) {
    return null;
  }

  return {
    streetName: address.streetName,
    streetNumber: address.streetNumber,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country
  };
}

function clampDiscount(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function mapProductSearchHit(
  product: NonNullable<ProductSearchResponse["results"]>[number],
  commerceLocale: string
): ProductSearchHit | null {
  const current = product.masterData?.current;
  const masterVariant = current?.masterVariant;

  const sku =
    (typeof product.sku === "string" && product.sku.trim()) ||
    (typeof masterVariant?.sku === "string" && masterVariant.sku.trim()) ||
    (typeof current?.allVariants?.[0]?.sku === "string" && current.allVariants[0].sku.trim()) ||
    (typeof product.key === "string" && product.key.trim()) ||
    (typeof product.id === "string" && product.id.trim()) ||
    "";

  const rawNameLocales = current?.nameAllLocales ?? product.nameAllLocales;
  const localeName = Array.isArray(rawNameLocales)
    ? rawNameLocales.find((locale) => locale.locale === commerceLocale)?.value ||
      rawNameLocales.find((locale) => locale.locale === "en")?.value ||
      rawNameLocales[0]?.value
    : "";
  const name = product.name ? String(product.name) : localeName || sku;

  let price = 0;
  if (typeof product.price === "number") {
    price = product.price;
  } else if (masterVariant?.prices?.[0]?.value) {
    const value = masterVariant.prices[0].value;
    const fractionDigits = typeof value.fractionDigits === "number" ? value.fractionDigits : 2;
    price = (value.centAmount || 0) / 10 ** fractionDigits;
  } else if (product.price) {
    price = parseFloat(String(product.price).replace(/[^0-9.]/g, "")) || 0;
  }

  return sku
    ? {
        sku,
        name,
        price,
        taxCategoryName: product.taxCategory?.name || null
      }
    : null;
}

export function QuoteCreateView() {
  const router = useRouter();
  const t = useTranslations("QuoteCreate");
  const locale = useLocale();
  const currentLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const commerceLocale = toCommerceLocale(currentLocale);
  const { allCompanies } = useCompanies();
  const { allEmployees } = useEmployees();

  const [companyId, setCompanyId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [discountPctInput, setDiscountPctInput] = useState("10");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [productQueries, setProductQueries] = useState<Record<string, string>>({});
  const [activeSearchLineId, setActiveSearchLineId] = useState<string | null>(null);
  const [productSearchResults, setProductSearchResults] = useState<ProductSearchHit[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  useEffect(() => {
    setValidUntil(
      (current) =>
        current ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    );
  }, []);

  const companyOptions = [
    { value: "", label: t("selectCompany") },
    ...allCompanies.map((c) => ({ value: c.id, label: c.name }))
  ];

  const availableEmployees = allEmployees.filter(
    (e) => !companyId || e.memberships.some((m) => m.companyId === companyId)
  );

  const customerOptions = [
    { value: "", label: t("selectCustomer") },
    ...availableEmployees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName} (${e.email})`
    }))
  ];
  const selectedCompany = allCompanies.find((company) => company.id === companyId);
  const selectedEmployee = allEmployees.find((employee) => employee.id === customerId);
  const selectedShippingAddress = quoteAddressFrom(
    selectedEmployee?.addresses.find((address) => address.isDefaultShipping) ||
      selectedEmployee?.addresses[0] ||
      selectedCompany?.addresses.find((address) => address.isDefaultShipping) ||
      selectedCompany?.addresses[0]
  );
  const selectedBillingAddress = quoteAddressFrom(
    selectedEmployee?.addresses.find((address) => address.isDefaultBilling) ||
      selectedShippingAddress ||
      selectedCompany?.addresses.find((address) => address.isDefaultBilling) ||
      selectedCompany?.addresses[0]
  );

  const activeProductQuery = activeSearchLineId ? productQueries[activeSearchLineId] || "" : "";

  useEffect(() => {
    const trimmed = activeProductQuery.trim();
    if (!activeSearchLineId || trimmed.length < 4) {
      setProductSearchResults([]);
      setIsSearchingProducts(false);
      return;
    }

    let cancelled = false;
    setIsSearchingProducts(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/product-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, limit: 8, offset: 0 })
        });

        if (!response.ok) {
          if (!cancelled) setProductSearchResults([]);
          return;
        }

        const data = (await response.json()) as ProductSearchResponse;
        const results = (data.results || [])
          .map((product) => mapProductSearchHit(product, commerceLocale))
          .filter((product): product is ProductSearchHit => Boolean(product));

        if (!cancelled) setProductSearchResults(results);
      } catch (error) {
        console.error("Quote product search failed:", error);
        if (!cancelled) setProductSearchResults([]);
      } finally {
        if (!cancelled) setIsSearchingProducts(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeProductQuery, activeSearchLineId, commerceLocale]);

  const handleAddLineItem = () => {
    const newItem: QuoteLineItem = {
      id: `line-${Date.now()}`,
      sku: "",
      name: "",
      quantity: 1,
      listPrice: 0,
      negotiatedPrice: 0,
      subtotal: 0
    };
    setLineItems((prev) => [...prev, newItem]);
    setProductQueries((prev) => ({ ...prev, [newItem.id]: "" }));
    setActiveSearchLineId(newItem.id);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
    setProductQueries((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeSearchLineId === id) {
      setActiveSearchLineId(null);
      setProductSearchResults([]);
    }
  };

  const handleLineNameChange = (id: string, name: string) => {
    setProductQueries((prev) => ({ ...prev, [id]: name }));
    setActiveSearchLineId(id);
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.name === name) return item;
        return {
          ...item,
          sku: "",
          name,
          listPrice: 0,
          negotiatedPrice: 0,
          subtotal: 0
        };
      })
    );
  };

  const handleSelectProduct = (id: string, product: ProductSearchHit) => {
    if (!product.taxCategoryName) {
      setFeedback(t("errors.missingTaxCategory", { product: product.name }));
      return;
    }

    setFeedback("");
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          sku: product.sku,
          name: product.name,
          listPrice: product.price,
          negotiatedPrice: product.price,
          subtotal: product.price * item.quantity
        };
      })
    );
    setProductQueries((prev) => ({ ...prev, [id]: product.name }));
    setActiveSearchLineId(null);
    setProductSearchResults([]);
  };

  const handleLineQtyChange = (id: string, qty: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const validQty = Math.max(1, qty);
        return {
          ...item,
          quantity: validQty,
          subtotal: item.negotiatedPrice * validQty
        };
      })
    );
  };

  const handleLinePriceChange = (id: string, price: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const validPrice = Math.max(0, price);
        return {
          ...item,
          negotiatedPrice: validPrice,
          subtotal: validPrice * item.quantity
        };
      })
    );
  };

  const parsedDiscountPct = Number(discountPctInput);
  const hasValidDiscount =
    discountPctInput.trim() !== "" &&
    Number.isFinite(parsedDiscountPct) &&
    parsedDiscountPct >= 0 &&
    parsedDiscountPct <= 100;
  const discountPct = hasValidDiscount ? parsedDiscountPct : 0;
  const grossSubtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const negotiatedTotal = grossSubtotal * ((100 - discountPct) / 100);
  const today = new Date().toISOString().slice(0, 10);
  const hasValidDate = Boolean(validUntil && validUntil >= today);
  const hasSelectedProducts = lineItems.length > 0 && lineItems.every((item) => item.sku && item.quantity > 0);
  const canSubmitQuote = Boolean(
    companyId &&
      hasSelectedProducts &&
      hasValidDate &&
      hasValidDiscount &&
      selectedShippingAddress &&
      !submitting
  );

  const handleSubmitQuote = async () => {
    if (!canSubmitQuote) return;
    if (!selectedShippingAddress) {
      setFeedback(t("errors.shippingAddress"));
      return;
    }

    setSubmitting(true);
    setFeedback("");

    try {
      const cartResponse = await fetch("/api/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: "USD",
          businessUnitKey: selectedCompany?.key,
          customerId: selectedEmployee?.id,
          customerEmail: selectedEmployee?.email
        })
      });
      const cartPayload = (await cartResponse.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };

      if (!cartResponse.ok || !cartPayload.id) {
        throw new Error(cartPayload.error || t("errors.createCart"));
      }

      const updateResponse = await fetch(`/api/carts/${encodeURIComponent(cartPayload.id)}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: [
            { setShippingAddress: { address: selectedShippingAddress } },
            ...(selectedBillingAddress ? [{ setBillingAddress: { address: selectedBillingAddress } }] : []),
            ...lineItems.map((item) => ({
              addLineItem: { sku: item.sku, quantity: item.quantity }
            }))
          ]
        })
      });
      const updatePayload = (await updateResponse.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!updateResponse.ok) {
        throw new Error(updatePayload.error || t("errors.addItems"));
      }

      const quoteComment = [
        note.trim() ? `Buyer note: ${note.trim()}` : "",
        `Valid until: ${validUntil}`,
        `Requested discount: ${discountPct}%`,
        `Negotiated total shown in Studio: $${negotiatedTotal.toFixed(2)}`
      ].filter(Boolean).join("\n");

      const quoteResponse = await fetch("/api/quotes/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: cartPayload.id,
          comment: quoteComment
        })
      });
      const quotePayload = (await quoteResponse.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };

      if (!quoteResponse.ok || !quotePayload.id) {
        throw new Error(quotePayload.error || t("errors.submit"));
      }

      const authoredLineItems: AuthoredQuoteLineItem[] = lineItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: String(item.quantity),
        sku: item.sku,
        unitPrice: String(item.negotiatedPrice)
      }));

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `csa_quote_review_${quotePayload.id}`,
          JSON.stringify({
            actingRole: "buyer",
            buyerDeclineNote: "",
            buyerNegotiationNote: "",
            buyerReviewState: "pending",
            buyerReviewUpdatedAt: null,
            convertedAt: null,
            convertedOrderId: null,
            convertedOrderNumber: null,
            requestedDiscount: String(discountPct),
            requestedLineItems: authoredLineItems,
            sellerNegotiationNote: "",
            sellerReviewUpdatedAt: null,
            sourceCartId: cartPayload.id
          })
        );
      }

      router.push(
        localizePathname(`/b2b/quotes/${encodeURIComponent(quotePayload.id)}`, currentLocale)
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("errors.submit"));
      setSubmitting(false);
    }
  };

  const quoteListPath = localizePathname("/b2b/quotes", currentLocale);
  const formatMoney = (value: number) =>
    new Intl.NumberFormat(currentLocale, {
      currency: "USD",
      style: "currency"
    }).format(value);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={
          <div className="flex items-center gap-1 text-xs text-m-text-muted">
            <button
              onClick={() => router.push(quoteListPath)}
              className="hover:text-m-primary"
            >
              {t("quotes")}
            </button>
            <span>/</span>
            <span>{t("create")}</span>
          </div>
        }
        actions={
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(quoteListPath)}
          >
            {t("cancel")}
          </Button>
        }
      />

      {/* Panel 1: Target Buyer & Company */}
      <Panel title={t("buyerContext")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              {t("targetCompany")} <span className="text-m-danger">*</span>
            </label>
            <Select
              value={companyId}
              options={companyOptions}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setCustomerId("");
              }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              {t("customerAssociate")}
            </label>
            <Select
              value={customerId}
              options={customerOptions}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>
        </div>
      </Panel>

      {/* Panel 2: Line Items Builder */}
      <Panel
        title={t("lineItemsTitle", { count: lineItems.length })}
        headerActions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="plus" size="xs" />}
            onClick={handleAddLineItem}
          >
            {t("addProduct")}
          </Button>
        }
      >
        <div className="p-5 flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.productName")}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="w-24">{t("columns.quantity")}</TableHead>
                <TableHead className="w-32">{t("columns.listPrice")}</TableHead>
                <TableHead className="w-36">{t("columns.negotiatedUnit")}</TableHead>
                <TableHead className="w-32 text-right">{t("columns.lineTotal")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-m-text-muted">
                    {t("emptyLineItems")}
                  </TableCell>
                </TableRow>
              ) : (
                lineItems.map((item) => {
                  const query = productQueries[item.id] ?? item.name;
                  const trimmedQuery = query.trim();
                  const isActiveSearchLine = activeSearchLineId === item.id;
                  const showProductResults = isActiveSearchLine && trimmedQuery.length >= 4;

                  return (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell className="min-w-64">
                        <Input
                          autoFocus={isActiveSearchLine && !item.name}
                          value={query}
                          onFocus={() => setActiveSearchLineId(item.id)}
                          onChange={(e) => handleLineNameChange(item.id, e.target.value)}
                          placeholder={
                            isActiveSearchLine
                              ? t("searchMinCharacters")
                              : t("searchByNameOrSku")
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-m-text-muted">
                        {item.sku || "--"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineQtyChange(item.id, Number(e.target.value))
                          }
                        />
                      </TableCell>
                      <TableCell className="text-m-text-muted">
                        {formatMoney(item.listPrice)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={item.negotiatedPrice}
                          onChange={(e) =>
                            handleLinePriceChange(item.id, Number(e.target.value))
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-m-text">
                        {formatMoney(item.subtotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          leftIcon={<Icon name="trash-2" size="xs" />}
                          onClick={() => handleRemoveLineItem(item.id)}
                        />
                      </TableCell>
                    </TableRow>
                    {showProductResults && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-m-surface-2/40 pt-0">
                          <div className="max-w-xl overflow-hidden rounded-m-md border border-m-border bg-m-surface shadow-m-panel">
                            {isSearchingProducts ? (
                              <div className="px-3 py-2 text-sm text-m-text-muted">
                                {t("searchingProducts")}
                              </div>
                            ) : productSearchResults.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-m-text-muted">
                                {t("noProducts")}
                              </div>
                            ) : (
                              productSearchResults.map((product) => {
                                const isQuotable = Boolean(product.taxCategoryName);

                                return (
                                <button
                                  key={`${product.sku}-${product.name}`}
                                  type="button"
                                  disabled={!isQuotable}
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-m-surface-1 disabled:cursor-not-allowed disabled:bg-m-error-light/40 disabled:opacity-70"
                                  onClick={() => handleSelectProduct(item.id, product)}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold text-m-text">
                                      {product.name}
                                    </span>
                                    <span className="block truncate font-mono text-xs text-m-text-muted">
                                      {product.sku}
                                    </span>
                                    {!isQuotable && (
                                      <span className="block truncate text-xs font-semibold text-m-error">
                                        {t("missingTaxCategory")}
                                      </span>
                                    )}
                                  </span>
                                  <span className="shrink-0 font-semibold text-m-text">
                                    {formatMoney(product.price)}
                                  </span>
                                </button>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* Panel 3: Financial Summary & Offer Settings */}
      <Panel title={t("offerTerms")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">
                {t("volumeDiscount")}
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountPctInput}
                error={!hasValidDiscount}
                onChange={(e) => setDiscountPctInput(e.target.value)}
                onBlur={() => {
                  const nextValue = discountPctInput.trim();
                  if (!nextValue) return;

                  const parsedValue = Number(nextValue);
                  if (Number.isFinite(parsedValue)) {
                    setDiscountPctInput(String(clampDiscount(parsedValue)));
                  }
                }}
              />
              {!hasValidDiscount && (
                <p className="mt-1 text-xs font-medium text-m-danger">
                  {t("discountValidation")}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">
                {t("validUntil")}
              </label>
              <Input
                type="date"
                min={today}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
              {!hasValidDate && (
                <p className="mt-1 text-xs font-medium text-m-danger">
                  {t("dateValidation")}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">
                {t("offerNotes")}
              </label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("offerNotesPlaceholder")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-m-xl bg-m-surface-1 border border-m-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-m-text mb-2">
              {t("calculationSummary")}
            </h4>
            <div className="flex justify-between border-b border-m-border/60 pb-2 text-sm">
              <span className="text-m-text-muted">{t("grossSubtotal")}</span>
              <span className="font-semibold text-m-text">
                {formatMoney(grossSubtotal)}
              </span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2 text-sm">
              <span className="text-m-text-muted">{t("appliedDiscount")}</span>
              <span className="font-semibold text-m-success">-{discountPct}%</span>
            </div>
            <div className="flex justify-between text-base pt-1">
              <span className="font-bold text-m-text">{t("negotiatedTotal")}</span>
              <span className="font-bold text-m-primary">
                {formatMoney(negotiatedTotal)}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {feedback && (
        <div className="rounded-m-md border border-m-error-border bg-m-error-light px-4 py-3 text-xs font-semibold text-m-error-dark">
          {feedback}
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" size="md" onClick={() => router.push(quoteListPath)}>
          {t("cancel")}
        </Button>
        <Button variant="outline" size="md" disabled>
          {t("saveDraft")}
        </Button>
        <Button variant="primary" size="md" disabled={!canSubmitQuote} onClick={handleSubmitQuote}>
          {submitting ? t("submitting") : t("submitToBuyer")}
        </Button>
      </div>
    </div>
  );
}
