"use client";

import { gql, useMutation, useQuery } from "@apollo/client";
import { DEFAULT_LOCALE, isSupportedLocale } from "@csa/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Badge,
  Button,
  CardEmpty,
  FormField,
  Icon,
  Input,
  Label,
  Modal,
  PageHeader,
  Panel,
  SearchBar,
  Select,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type StatusTone
} from "@csa/ui";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { localizePathname } from "@/i18n/routing";
import { useSubscriptions } from "../hooks/use-subscriptions";
import type {
  CustomerSubscription,
  SubscriptionDraft,
  SubscriptionFrequency,
  SubscriptionStatus
} from "../types/subscription-types";

const STATUS_OPTIONS: SubscriptionStatus[] = [
  "Draft",
  "Active",
  "Paused",
  "On Hold",
  "Cancelled",
  "Expired"
];
const FREQUENCY_OPTIONS: SubscriptionFrequency[] = [
  "Weekly",
  "Every 2 weeks",
  "Monthly",
  "Quarterly",
  "Yearly"
];

const AVAILABLE_CURRENCIES_QUERY = gql`
  query AvailableSubscriptionCurrencies {
    availableCurrencies
  }
`;

const PRODUCT_PRICES_QUERY = gql`
  query SubscriptionProductPrices($sku: String!) {
    productPrices(sku: $sku) {
      centAmount
      currencyCode
      fractionDigits
    }
  }
`;

const CUSTOMER_ADDRESSES_QUERY = gql`
  query SubscriptionCustomerAddresses($id: ID!) {
    customerAddresses(id: $id)
  }
`;

const ADD_CUSTOMER_ADDRESS = gql`
  mutation AddSubscriptionCustomerAddress($id: ID!, $address: Json!, $addressType: String) {
    addCustomerAddress(id: $id, address: $address, addressType: $addressType)
  }
`;

const ADDRESS_COUNTRY_CODES = ["US", "CA", "GB", "DE", "FR", "AU", "IN", "NZ"];

type SubscriptionManagementViewProps = {
  customerContext?: {
    id: string;
    name: string;
    email: string;
    defaultAddress?: string;
  };
  embedded?: boolean;
};

type FormState = {
  ownerType: "B2C" | "B2B";
  customerId: string;
  customerName: string;
  customerEmail: string;
  businessAccountName: string;
  status: SubscriptionStatus;
  productName: string;
  sku: string;
  quantity: string;
  unitPrice: string;
  frequency: SubscriptionFrequency;
  startDate: string;
  scheduleTime: string;
  nextDeliveryDate: string;
  endDate: string;
  shippingAddress: string;
  paymentMethod: string;
  currencyCode: string;
  discountLabel: string;
  priceOverride: string;
  lineItems: SubscriptionLineItemForm[];
};

type SubscriptionLineItemForm = {
  id: string;
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string;
};

type CustomerSearchResult = {
  id: string;
  name: string;
  email: string;
};

type ProductSearchResult = {
  id?: string;
  sku?: string;
  name?: string;
  price?: {
    centAmount?: number;
    currencyCode?: string;
    fractionDigits?: number;
  };
};

type ProductPrice = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

type CustomerAddress = {
  id: string;
  streetName?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type CustomerAddressesResult = {
  addresses: CustomerAddress[];
  defaultShippingAddressId: string | null;
  shippingAddressIds: string[];
};

type NewAddressForm = {
  streetName: string;
  streetNumber: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function emptyNewAddress(): NewAddressForm {
  return {
    streetName: "",
    streetNumber: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US"
  };
}

function formatAddress(address: Omit<CustomerAddress, "id">) {
  const street = [address.streetNumber, address.streetName].filter(Boolean).join(" ");
  const locality = [address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");
  return [street, locality, address.country].filter(Boolean).join("\n");
}

function emptyForm(
  customerContext?: SubscriptionManagementViewProps["customerContext"],
  defaultPaymentMethod = "Authorized card on file"
): FormState {
  return {
    ownerType: "B2C",
    customerId: customerContext?.id ?? "",
    customerName: customerContext?.name ?? "",
    customerEmail: customerContext?.email ?? "",
    businessAccountName: "",
    status: "Draft",
    productName: "",
    sku: "",
    quantity: "1",
    unitPrice: "",
    frequency: "Monthly",
    startDate: today(),
    scheduleTime: "09:00",
    nextDeliveryDate: nextMonth(),
    endDate: "",
    shippingAddress: customerContext?.defaultAddress ?? "",
    paymentMethod: defaultPaymentMethod,
    currencyCode: "",
    discountLabel: "",
    priceOverride: "",
    lineItems: []
  };
}

function formFromSubscription(subscription: CustomerSubscription): FormState {
  return {
    ownerType: subscription.ownerType,
    customerId: subscription.customerId ?? "",
    customerName: subscription.customerName,
    customerEmail: subscription.customerEmail,
    businessAccountName: subscription.businessAccountName ?? "",
    status: subscription.status,
    productName: "",
    sku: "",
    quantity: "1",
    unitPrice: "",
    frequency: subscription.frequency,
    startDate: subscription.startDate,
    scheduleTime: subscription.scheduleTime ?? new Date(subscription.createdAt).toTimeString().slice(0, 5),
    nextDeliveryDate: subscription.nextDeliveryDate,
    endDate: subscription.endDate ?? "",
    shippingAddress: subscription.shippingAddress,
    paymentMethod: subscription.paymentMethod,
    currencyCode: subscription.currencyCode,
    discountLabel: subscription.discountLabel ?? "",
    priceOverride: subscription.priceOverride ?? "",
    lineItems: subscription.lineItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice)
    }))
  };
}

function toDraft(form: FormState): SubscriptionDraft {
  return {
    ownerType: form.ownerType,
    customerId: form.customerId || undefined,
    customerName: form.customerName.trim(),
    customerEmail: form.customerEmail.trim(),
    businessAccountName: form.businessAccountName.trim() || undefined,
    status: form.status,
    frequency: form.frequency,
    startDate: form.startDate,
    scheduleTime: form.scheduleTime,
    nextDeliveryDate: form.nextDeliveryDate,
    endDate: form.endDate || undefined,
    shippingAddress: form.shippingAddress.trim(),
    paymentMethod: form.paymentMethod.trim(),
    currencyCode: form.currencyCode,
    discountLabel: form.discountLabel.trim() || undefined,
    priceOverride: form.priceOverride.trim() || undefined,
    lastOrderNumber: undefined,
    lineItems: form.lineItems.map((item, index) => ({
      id: item.id || `line-${index + 1}`,
      sku: item.sku.trim(),
      name: item.name.trim() || item.sku.trim(),
      quantity: Math.max(1, Number(item.quantity) || 1),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0)
    }))
  };
}

function statusTone(status: SubscriptionStatus): StatusTone {
  switch (status) {
    case "Active":
      return "success";
    case "On Hold":
    case "Paused":
    case "Draft":
      return "warning";
    case "Cancelled":
    case "Expired":
      return "error";
    default:
      return "neutral";
  }
}

function money(value: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: currencyCode,
    style: "currency"
  }).format(value);
}

function subscriptionTotal(subscription: CustomerSubscription) {
  return subscription.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
}

export function SubscriptionManagementView({
  customerContext,
  embedded = false
}: SubscriptionManagementViewProps) {
  const t = useTranslations("Subscriptions");
  const calendarT = useTranslations("Calendar");
  const lineItemsT = useTranslations("SubscriptionLineItems");
  const locale = useLocale();
  const router = useRouter();
  const currentLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const { data: currencyData, loading: currenciesLoading } = useQuery<{
    availableCurrencies: string[];
  }>(AVAILABLE_CURRENCIES_QUERY, { fetchPolicy: "cache-and-network" });
  const {
    subscriptions,
    createSubscription,
    updateSubscription,
    changeStatus,
    skipNextCycle,
    deleteDraft,
    error: subscriptionsError
  } = useSubscriptions(customerContext?.id);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubscriptionStatus>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerSubscription | null>(null);
  const [viewing, setViewing] = useState<CustomerSubscription | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(customerContext, t("defaultPaymentMethod"))
  );
  const [formError, setFormError] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<
    CustomerSearchResult[]
  >([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<
    ProductSearchResult[]
  >([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<NewAddressForm>(emptyNewAddress);
  const [addressError, setAddressError] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const defaultAddressAppliedForCustomer = useRef<string | null>(null);
  const { data: productPricesData, loading: productPricesLoading } = useQuery<{
    productPrices: ProductPrice[];
  }>(PRODUCT_PRICES_QUERY, {
    variables: { sku: form.sku.trim() },
    skip: form.sku.trim().length < 2 || !form.currencyCode,
    fetchPolicy: "cache-and-network"
  });
  const { data: addressesData, loading: addressesLoading, refetch: refetchAddresses } = useQuery<{
    customerAddresses: CustomerAddressesResult;
  }>(CUSTOMER_ADDRESSES_QUERY, {
    variables: { id: form.customerId },
    skip: !form.customerId,
    fetchPolicy: "cache-and-network"
  });
  const [addCustomerAddress] = useMutation(ADD_CUSTOMER_ADDRESS);

  const availableCurrencies = useMemo(
    () => [...new Set(currencyData?.availableCurrencies ?? [])].sort(),
    [currencyData]
  );
  const currencyOptions = useMemo(() => {
    const values = [...availableCurrencies];
    if (form.currencyCode && !values.includes(form.currencyCode)) {
      values.push(form.currencyCode);
    }
    return values.map((currencyCode) => ({
      value: currencyCode,
      label: availableCurrencies.includes(currencyCode)
        ? currencyCode
        : t("legacyCurrency", { currency: currencyCode })
    }));
  }, [availableCurrencies, form.currencyCode, t]);
  const countryOptions = ADDRESS_COUNTRY_CODES.map((countryCode) => ({
    value: countryCode,
    label: t(`countries.${countryCode}`)
  }));

  useEffect(() => {
    if (!editing && !form.currencyCode && availableCurrencies.length > 0) {
      setForm((previous) => ({ ...previous, currencyCode: availableCurrencies[0] }));
    }
  }, [availableCurrencies, editing, form.currencyCode]);

  const selectedCatalogPrice = useMemo(
    () =>
      productPricesData?.productPrices.find(
        (price) => price.currencyCode === form.currencyCode
      ),
    [form.currencyCode, productPricesData]
  );

  useEffect(() => {
    if (!form.sku.trim() || !form.currencyCode || productPricesLoading) return;
    setForm((previous) => {
      if (previous.sku !== form.sku || previous.currencyCode !== form.currencyCode) {
        return previous;
      }
      return {
        ...previous,
        unitPrice: selectedCatalogPrice
          ? String(
              selectedCatalogPrice.centAmount /
                10 ** selectedCatalogPrice.fractionDigits
            )
          : ""
      };
    });
  }, [form.currencyCode, form.sku, productPricesLoading, selectedCatalogPrice]);

  const savedAddresses = useMemo(
    () => addressesData?.customerAddresses.addresses ?? [],
    [addressesData]
  );
  const defaultShippingAddress = useMemo(() => {
    const result = addressesData?.customerAddresses;
    if (!result) return undefined;
    return (
      result.addresses.find((address) => address.id === result.defaultShippingAddressId) ??
      result.addresses.find((address) => result.shippingAddressIds.includes(address.id)) ??
      result.addresses[0]
    );
  }, [addressesData]);

  useEffect(() => {
    if (!form.customerId || !defaultShippingAddress) return;
    if (defaultAddressAppliedForCustomer.current === form.customerId) return;
    defaultAddressAppliedForCustomer.current = form.customerId;
    setForm((previous) => ({
      ...previous,
      shippingAddress: formatAddress(defaultShippingAddress)
    }));
  }, [defaultShippingAddress, form.customerId]);

  const customerSearchText = useMemo(() => {
    return `${form.customerName} ${form.customerEmail}`.trim();
  }, [form.customerEmail, form.customerName]);
  const productSearchText = useMemo(() => {
    return `${form.sku} ${form.productName}`.trim();
  }, [form.productName, form.sku]);

  useEffect(() => {
    if (customerContext || editing || form.ownerType !== "B2C") {
      setCustomerSearchResults([]);
      setCustomerSearchError("");
      setCustomerSearchLoading(false);
      return;
    }

    const queryText = customerSearchText.trim();
    if (queryText.length < 2) {
      setCustomerSearchResults([]);
      setCustomerSearchError("");
      setCustomerSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setCustomerSearchLoading(true);
      setCustomerSearchError("");
      try {
        const response = await fetch(
          `/api/customers/search?q=${encodeURIComponent(queryText)}`
        );
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          results?: CustomerSearchResult[];
        };
        if (!response.ok) {
          throw new Error(payload.error || t("errors.searchCustomers"));
        }
        if (!cancelled) {
          setCustomerSearchResults(payload.results ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setCustomerSearchResults([]);
          setCustomerSearchError(
            error instanceof Error ? error.message : t("errors.searchCustomers")
          );
        }
      } finally {
        if (!cancelled) setCustomerSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [customerContext, customerSearchText, editing, form.ownerType, t]);

  useEffect(() => {
    if (!productSearchOpen) {
      setProductSearchResults([]);
      setProductSearchError("");
      setProductSearchLoading(false);
      return;
    }

    const queryText = productSearchText.trim();
    if (queryText.length < 2) {
      setProductSearchResults([]);
      setProductSearchError("");
      setProductSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setProductSearchLoading(true);
      setProductSearchError("");
      try {
        const response = await fetch(
          `/api/product-search?q=${encodeURIComponent(queryText)}`
        );
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          results?: ProductSearchResult[];
        };
        if (!response.ok) {
          throw new Error(payload.error || t("errors.searchProducts"));
        }
        if (!cancelled) {
          setProductSearchResults(payload.results ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setProductSearchResults([]);
          setProductSearchError(
            error instanceof Error ? error.message : t("errors.searchProducts")
          );
        }
      } finally {
        if (!cancelled) setProductSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [productSearchOpen, productSearchText, t]);

  const filteredSubscriptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      if (statusFilter !== "all" && subscription.status !== statusFilter) return false;
      if (!needle) return true;
      return [
        subscription.subscriptionNumber,
        subscription.customerName,
        subscription.customerEmail,
        subscription.businessAccountName,
        subscription.status,
        ...subscription.lineItems.flatMap((item) => [item.sku, item.name])
      ].some((value) => (value ?? "").toLowerCase().includes(needle));
    });
  }, [query, statusFilter, subscriptions]);

  const counts = useMemo(() => {
    return {
      active: subscriptions.filter((subscription) => subscription.status === "Active")
        .length,
      paused: subscriptions.filter((subscription) =>
        subscription.status === "Paused" || subscription.status === "On Hold"
      ).length,
      draft: subscriptions.filter((subscription) => subscription.status === "Draft")
        .length
    };
  }, [subscriptions]);

  const openCreate = () => {
    defaultAddressAppliedForCustomer.current = null;
    setEditing(null);
    setViewing(null);
    setForm(emptyForm(customerContext, t("defaultPaymentMethod")));
    setFormError("");
    setIsModalOpen(true);
  };

  const selectCustomer = (customer: CustomerSearchResult) => {
    defaultAddressAppliedForCustomer.current = null;
    setForm((prev) => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email
    }));
    setCustomerSearchResults([]);
    setCustomerSearchError("");
  };

  const selectAddress = (address: CustomerAddress) => {
    setForm((previous) => ({
      ...previous,
      shippingAddress: formatAddress(address)
    }));
    setAddressError("");
  };

  const saveNewAddress = async () => {
    if (!form.customerId) {
      setAddressError(t("errors.selectCustomerForAddress"));
      return;
    }
    if (
      !newAddress.streetName.trim() ||
      !newAddress.city.trim() ||
      !newAddress.postalCode.trim() ||
      !newAddress.country
    ) {
      setAddressError(t("errors.addressRequired"));
      return;
    }

    setAddingAddress(true);
    setAddressError("");
    try {
      const address = {
        streetName: newAddress.streetName.trim(),
        streetNumber: newAddress.streetNumber.trim() || undefined,
        city: newAddress.city.trim(),
        state: newAddress.state.trim() || undefined,
        postalCode: newAddress.postalCode.trim(),
        country: newAddress.country
      };
      await addCustomerAddress({
        variables: { id: form.customerId, address, addressType: "shipping" }
      });
      await refetchAddresses();
      setForm((previous) => ({ ...previous, shippingAddress: formatAddress(address) }));
      setNewAddress(emptyNewAddress());
      setShowNewAddress(false);
    } catch (error) {
      setAddressError(
        error instanceof Error ? error.message : t("errors.addAddress")
      );
    } finally {
      setAddingAddress(false);
    }
  };

  const selectProduct = (product: ProductSearchResult) => {
    const centAmount = product.price?.centAmount;
    const fractionDigits = product.price?.fractionDigits ?? 2;
    const unitPrice =
      typeof centAmount === "number"
        ? String(centAmount / 10 ** fractionDigits)
        : form.unitPrice;

    setForm((prev) => ({
      ...prev,
      productName: product.name || prev.productName,
      sku: product.sku || prev.sku,
      unitPrice,
      currencyCode: product.price?.currencyCode || prev.currencyCode
    }));
    setProductSearchOpen(false);
    setProductSearchResults([]);
    setProductSearchError("");
  };

  const addLineItem = () => {
    if (!form.sku.trim()) {
      setFormError(t("errors.skuRequired"));
      return;
    }

    const nextItem: SubscriptionLineItemForm = {
      id: `line-${Date.now()}-${form.lineItems.length + 1}`,
      sku: form.sku.trim(),
      name: form.productName.trim() || form.sku.trim(),
      quantity: String(Math.max(1, Number(form.quantity) || 1)),
      unitPrice: String(Math.max(0, Number(form.unitPrice) || 0))
    };

    setForm((previous) => ({
      ...previous,
      lineItems: [...previous.lineItems, nextItem],
      productName: "",
      sku: "",
      quantity: "1",
      unitPrice: ""
    }));
    setFormError("");
    setProductSearchOpen(false);
    setProductSearchResults([]);
  };

  const updateLineItem = (
    id: string,
    field: keyof Omit<SubscriptionLineItemForm, "id">,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      lineItems: previous.lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeLineItem = (id: string) => {
    setForm((previous) => ({
      ...previous,
      lineItems: previous.lineItems.filter((item) => item.id !== id)
    }));
  };

  const openEdit = (subscription: CustomerSubscription) => {
    setViewing(null);
    setEditing(subscription);
    setForm(formFromSubscription(subscription));
    setFormError("");
    setIsModalOpen(true);
  };

  const openView = (subscription: CustomerSubscription) => {
    setIsModalOpen(false);
    setEditing(null);
    setViewing(subscription);
  };

  const saveSubscription = async () => {
    if (!form.customerName.trim() || !form.customerEmail.trim()) {
      setFormError(t("errors.customerRequired"));
      return;
    }
    if (form.lineItems.length === 0) {
      setFormError(t("errors.skuRequired"));
      return;
    }
    if (!form.currencyCode) {
      setFormError(t("errors.currencyRequired"));
      return;
    }
    if (
      !form.nextDeliveryDate ||
      !form.shippingAddress.trim() ||
      !form.paymentMethod.trim()
    ) {
      setFormError(
        t("errors.deliveryRequired")
      );
      return;
    }

    const draft = toDraft(form);
    try {
      if (editing) {
        await updateSubscription(editing.id, draft);
      } else {
        await createSubscription(draft);
      }
      setIsModalOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("errors.save")
      );
    }
  };

  const cancelSubscription = async (subscription: CustomerSubscription) => {
    const reason = window.prompt(t("cancellationReason"));
    if (reason == null) return;
    await changeStatus(subscription.id, "Cancelled", reason.trim() || t("noReasonProvided"));
  };

  const renderActions = (subscription: CustomerSubscription) => (
    <div className="flex min-w-[290px] items-center gap-0.5 whitespace-nowrap">
      <Button variant="ghost" size="sm" onClick={() => openView(subscription)}>
        {t("actions.view")}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => openEdit(subscription)}>
        {t("actions.edit")}
      </Button>
      {subscription.status === "Active" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void changeStatus(subscription.id, "On Hold", "Put on hold by agent")}
          >
            {t("actions.hold")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void skipNextCycle(subscription.id)}
          >
            {t("actions.skip")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void cancelSubscription(subscription)}
          >
            {t("actions.cancel")}
          </Button>
        </>
      )}
      {(subscription.status === "Paused" || subscription.status === "On Hold") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void changeStatus(subscription.id, "Active", "Resumed by agent")}
        >
          {t("actions.resume")}
        </Button>
      )}
      {subscription.status === "Draft" && (
        <Button variant="ghost" size="sm" onClick={() => void deleteDraft(subscription.id)}>
          {t("actions.deleteDraft")}
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {!embedded && (
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          breadcrumbs={
            <span className="text-xs font-medium uppercase tracking-widest text-m-text-muted">
              {t("commerce")}
            </span>
          }
          actions={
            <>
              <Button
                variant="secondary"
                leftIcon={<Icon name="calendar-days" size="xs" />}
                onClick={() => router.push(localizePathname("/calendar", currentLocale))}
              >
                {calendarT("button")}
              </Button>
              <Button
                variant="primary"
                leftIcon={<Icon name="plus" size="xs" />}
                onClick={openCreate}
              >
                {t("newSubscription")}
              </Button>
            </>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel title={t("status.Active")}>
          <div className="p-4 text-2xl font-bold text-m-text">{counts.active}</div>
        </Panel>
        <Panel title={t("pausedOrOnHold")}>
          <div className="p-4 text-2xl font-bold text-m-text">{counts.paused}</div>
        </Panel>
        <Panel title={t("drafts")}>
          <div className="p-4 text-2xl font-bold text-m-text">{counts.draft}</div>
        </Panel>
      </div>

      <Panel
        title={embedded ? t("title") : t("managementTitle")}
        headerActions={
          embedded ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={openCreate}
            >
              {t("newSubscription")}
            </Button>
          ) : undefined
        }
      >
        {subscriptionsError && (
          <div className="border-b border-m-error-border bg-m-error-light px-3 py-2 text-xs font-semibold text-m-error">
            {subscriptionsError.message}
          </div>
        )}
        <div className="flex flex-col gap-3 border-b border-m-border/70 p-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
              placeholder={t("searchPlaceholder")}
            />
          </div>
          <div className="w-full md:w-52">
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | SubscriptionStatus)
              }
              options={[
                { value: "all", label: t("allStatuses") },
                ...STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: t(`status.${status}`)
                }))
              ]}
            />
          </div>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <CardEmpty
            icon="repeat"
            title={t("emptyTitle")}
            hint={
              customerContext
                ? t("emptyCustomerHint")
                : t("emptyDefaultHint")
            }
          />
        ) : (
          <Table className="min-w-[1560px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.subscription")}</TableHead>
                {!customerContext && <TableHead>{t("columns.customer")}</TableHead>}
                <TableHead>{t("columns.createdBy")}</TableHead>
                <TableHead>{t("columns.product")}</TableHead>
                <TableHead>{t("columns.cadence")}</TableHead>
                <TableHead>{t("columns.nextDelivery")}</TableHead>
                <TableHead>{t("columns.price")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="w-[310px] whitespace-nowrap">
                  {t("columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.map((subscription) => {
                return (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="font-mono text-xs font-bold text-m-primary">
                        {subscription.subscriptionNumber}
                      </div>
                      <div className="text-[11px] text-m-text-muted">
                        {t("updated", {
                          date: formatDateTime(subscription.updatedAt, locale)
                        })}
                      </div>
                    </TableCell>
                    {!customerContext && (
                      <TableCell>
                        <div className="font-semibold text-m-text">
                          {subscription.customerName}
                        </div>
                        <div className="text-[11px] text-m-text-muted">
                          {subscription.customerEmail}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="text-xs font-semibold text-m-text">
                        {subscription.createdBy}
                      </div>
                    </TableCell>
                    <TableCell>
                      {subscription.lineItems.length === 0 ? (
                        <span className="text-m-text-muted">--</span>
                      ) : (
                        <div className="space-y-2">
                          {subscription.lineItems.map((item) => (
                            <div key={item.id}>
                              <div className="font-semibold text-m-text">{item.name}</div>
                              <div className="text-[11px] text-m-text-muted">
                                {item.sku} × {item.quantity}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{t(`frequency.${subscription.frequency}`)}</TableCell>
                    <TableCell>{formatDate(subscription.nextDeliveryDate, locale)}</TableCell>
                    <TableCell>
                      <div className="font-semibold">
                        {money(
                          subscriptionTotal(subscription),
                          subscription.currencyCode,
                          locale
                        )}
                      </div>
                      {subscription.discountLabel && (
                        <div className="text-[11px] text-m-success">
                          {subscription.discountLabel}
                        </div>
                      )}
                      {subscription.priceOverride && (
                        <Badge variant="warning" size="sm">
                          {t("override")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={statusTone(subscription.status)}>
                        {t(`status.${subscription.status}`)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="w-[310px] whitespace-nowrap">
                      {renderActions(subscription)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} size="xl">
        {viewing && (
          <>
            <Modal.Header
              title={t("viewTitle", { number: viewing.subscriptionNumber })}
              subtitle={t("viewSubtitle")}
              onClose={() => setViewing(null)}
            />
            <Modal.Body>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    {t("columns.status")}
                  </div>
                  <div className="mt-2">
                    <StatusPill tone={statusTone(viewing.status)}>
                      {t(`status.${viewing.status}`)}
                    </StatusPill>
                  </div>
                </div>
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    {t("frequencyLabel")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-m-text">
                    {t(`frequency.${viewing.frequency}`)}
                  </div>
                </div>
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    {t("columns.nextDelivery")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-m-text">
                    {formatDate(viewing.nextDeliveryDate, locale)}
                  </div>
                </div>
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    {t("recurringPrice")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-m-text">
                    {money(subscriptionTotal(viewing), viewing.currencyCode, locale)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    {t("columns.customer")}
                  </div>
                  <div className="text-sm font-semibold text-m-text">
                    {viewing.customerName}
                  </div>
                  <div className="mt-1 text-xs text-m-text-muted">
                    {viewing.customerEmail}
                  </div>
                  {viewing.businessAccountName && (
                    <div className="mt-3 text-xs text-m-text">
                      {t("account")}: {" "}
                      <span className="font-semibold">
                        {viewing.businessAccountName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    {t("schedule")}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-m-text-muted">{t("startDate")}</div>
                      <div className="font-semibold text-m-text">
                        {formatDate(viewing.startDate, locale)}
                      </div>
                    </div>
                    <div>
                      <div className="text-m-text-muted">{t("endDate")}</div>
                      <div className="font-semibold text-m-text">
                        {viewing.endDate
                          ? formatDate(viewing.endDate, locale)
                          : t("openEnded")}
                      </div>
                    </div>
                    <div>
                      <div className="text-m-text-muted">{t("payment")}</div>
                      <div className="font-semibold text-m-text">
                        {viewing.paymentMethod}
                      </div>
                    </div>
                    <div>
                      <div className="text-m-text-muted">{t("currency")}</div>
                      <div className="font-semibold text-m-text">
                        {viewing.currencyCode}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                  {t("products")}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columns.product")}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>{t("quantityShort")}</TableHead>
                      <TableHead>{t("unitPrice")}</TableHead>
                      <TableHead>{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewing.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-m-text">
                          {item.name || item.sku}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{money(item.unitPrice, viewing.currencyCode, locale)}</TableCell>
                        <TableCell className="font-semibold">
                          {money(item.unitPrice * item.quantity, viewing.currencyCode, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    {t("deliveryAddress")}
                  </div>
                  <div className="whitespace-pre-wrap text-xs font-medium text-m-text">
                    {viewing.shippingAddress}
                  </div>
                </div>

                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    {t("pricingControls")}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-m-text-muted">{t("discount")}: </span>
                      <span className="font-semibold text-m-text">
                        {viewing.discountLabel || t("none")}
                      </span>
                    </div>
                    <div>
                      <span className="text-m-text-muted">{t("priceOverride")}: </span>
                      <span className="font-semibold text-m-text">
                        {viewing.priceOverride || t("none")}
                      </span>
                    </div>
                    {viewing.cancellationReason && (
                      <div>
                        <span className="text-m-text-muted">{t("cancellationReason")}: </span>
                        <span className="font-semibold text-m-text">
                          {viewing.cancellationReason}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                  {t("linkedOrders")}
                </div>
                {viewing.linkedOrderNumbers.length === 0 ? (
                  <div className="text-xs text-m-text-muted">{t("noLinkedOrders")}</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {viewing.linkedOrderNumbers.map((orderNumber) => (
                      <Badge key={orderNumber} variant="neutral" size="sm">
                        {orderNumber}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                  {t("changeHistory")}
                </div>
                <div className="space-y-2">
                  {viewing.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-m-text">{entry.action}</div>
                        {entry.note && (
                          <div className="text-m-text-muted">{entry.note}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-m-text-muted">
                        {formatDateTime(entry.createdAt, locale)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setViewing(null)}>
                {t("actions.close")}
              </Button>
              <Button variant="primary" onClick={() => openEdit(viewing)}>
                {t("actions.editDetails")}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl">
        <Modal.Header
          title={
            editing
              ? t("editTitle", { number: editing.subscriptionNumber })
              : t("createTitle")
          }
          subtitle={t("formSubtitle")}
          onClose={() => setIsModalOpen(false)}
        />
        <Modal.Body>
          {formError && (
            <div className="rounded-m-md border border-m-error-border bg-m-error-light px-3 py-2 text-xs font-semibold text-m-error">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField>
              <Label>{t("ownerType")}</Label>
              <Select
                value={form.ownerType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    ownerType: event.target.value as "B2C" | "B2B"
                  }))
                }
                options={[
                  { value: "B2C", label: t("b2cCustomer") },
                  { value: "B2B", label: t("b2bAccount") }
                ]}
                disabled={Boolean(customerContext)}
              />
            </FormField>
            <FormField>
              <Label required>{t("customerName")}</Label>
              <Input
                value={form.customerName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, customerName: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label required>{t("customerEmail")}</Label>
              <Input
                value={form.customerEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, customerEmail: event.target.value }))
                }
              />
            </FormField>
          </div>

          {!customerContext && !editing && form.ownerType === "B2C" && (
            <div className="rounded-m-lg border border-m-border bg-m-surface-1">
              <div className="flex items-center justify-between gap-3 border-b border-m-border/70 px-3 py-2">
                <div className="text-xs font-semibold text-m-text">
                  {t("customerSearch")}
                </div>
                {customerSearchLoading && (
                  <div className="text-[11px] font-medium text-m-text-muted">
                    {t("searching")}
                  </div>
                )}
              </div>
              {customerSearchError ? (
                <div className="px-3 py-2 text-xs font-semibold text-m-error">
                  {customerSearchError}
                </div>
              ) : customerSearchText.trim().length < 2 ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  {t("customerSearchHint")}
                </div>
              ) : customerSearchResults.length === 0 && !customerSearchLoading ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  {t("noCustomers")}
                </div>
              ) : (
                <div className="divide-y divide-m-border/70">
                  {customerSearchResults.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-m-surface-2"
                      onClick={() => selectCustomer(customer)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-m-text">
                          {customer.name}
                        </div>
                        <div className="truncate text-[11px] text-m-text-muted">
                          {customer.email}
                        </div>
                      </div>
                      <Badge variant="primary" size="sm">
                        {t("actions.select")}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.ownerType === "B2B" && (
            <FormField>
              <Label>{t("businessAccount")}</Label>
              <Input
                value={form.businessAccountName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    businessAccountName: event.target.value
                  }))
                }
              />
            </FormField>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <FormField>
              <Label>{t("productName")}</Label>
              <Input
                value={form.productName}
                onChange={(event) => {
                  setProductSearchOpen(true);
                  setForm((prev) => ({ ...prev, productName: event.target.value }));
                }}
              />
            </FormField>
            <FormField>
              <Label required>SKU</Label>
              <Input
                value={form.sku}
                onChange={(event) => {
                  setProductSearchOpen(true);
                  setForm((prev) => ({ ...prev, sku: event.target.value }));
                }}
              />
            </FormField>
            <FormField>
              <Label>{t("quantity")}</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, quantity: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label required>{t("currency")}</Label>
              <Select
                value={form.currencyCode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, currencyCode: event.target.value }))
                }
                disabled={currenciesLoading || currencyOptions.length === 0}
                options={
                  currenciesLoading
                    ? [{ value: "", label: t("loadingCurrencies") }]
                    : currencyOptions.length > 0
                      ? currencyOptions
                      : [{ value: "", label: t("noCurrencies") }]
                }
              />
            </FormField>
            <FormField>
              <Label>{t("unitPrice")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.unitPrice}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, unitPrice: event.target.value }))
                }
              />
              {!productPricesLoading && form.sku.trim() && !selectedCatalogPrice && (
                <div className="mt-1 text-[11px] text-m-warning">
                  {t("noCatalogPrice", { currency: form.currencyCode })}
                </div>
              )}
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={addLineItem}
            >
              {lineItemsT("add")}
            </Button>
          </div>

          <div className="overflow-hidden rounded-m-lg border border-m-border bg-m-surface-1">
            <div className="flex items-center justify-between border-b border-m-border/70 px-3 py-2">
              <div className="text-xs font-semibold text-m-text">{lineItemsT("title")}</div>
              <Badge variant="neutral" size="sm">
                {lineItemsT("count", { count: form.lineItems.length })}
              </Badge>
            </div>
            {form.lineItems.length === 0 ? (
              <div className="px-3 py-3 text-xs text-m-text-muted">
                {lineItemsT("empty")}
              </div>
            ) : (
              <div className="divide-y divide-m-border/70">
                {form.lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 items-end gap-3 p-3 md:grid-cols-[minmax(0,1fr)_150px_100px_130px_auto]"
                  >
                    <FormField>
                      <Label>{t("productName")}</Label>
                      <Input
                        value={item.name}
                        onChange={(event) => updateLineItem(item.id, "name", event.target.value)}
                      />
                    </FormField>
                    <FormField>
                      <Label required>SKU</Label>
                      <Input
                        value={item.sku}
                        onChange={(event) => updateLineItem(item.id, "sku", event.target.value)}
                      />
                    </FormField>
                    <FormField>
                      <Label>{t("quantity")}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => updateLineItem(item.id, "quantity", event.target.value)}
                      />
                    </FormField>
                    <FormField>
                      <Label>{t("unitPrice")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => updateLineItem(item.id, "unitPrice", event.target.value)}
                      />
                    </FormField>
                    <Button
                      aria-label={lineItemsT("remove")}
                      variant="ghost"
                      size="sm"
                      iconOnly
                      leftIcon={<Icon name="trash-2" size="xs" />}
                      onClick={() => removeLineItem(item.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {productSearchOpen && (
            <div className="rounded-m-lg border border-m-border bg-m-surface-1">
              <div className="flex items-center justify-between gap-3 border-b border-m-border/70 px-3 py-2">
                <div className="text-xs font-semibold text-m-text">{t("skuSearch")}</div>
                {productSearchLoading && (
                  <div className="text-[11px] font-medium text-m-text-muted">
                    {t("searching")}
                  </div>
                )}
              </div>
              {productSearchError ? (
                <div className="px-3 py-2 text-xs font-semibold text-m-error">
                  {productSearchError}
                </div>
              ) : productSearchText.trim().length < 2 ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  {t("productSearchHint")}
                </div>
              ) : productSearchResults.length === 0 && !productSearchLoading ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  {t("noProducts")}
                </div>
              ) : (
                <div className="divide-y divide-m-border/70">
                  {productSearchResults.map((product) => {
                    const price =
                      typeof product.price?.centAmount === "number"
                        ? money(
                            product.price.centAmount /
                              10 ** (product.price.fractionDigits ?? 2),
                            product.price.currencyCode || form.currencyCode,
                            locale
                          )
                        : null;
                    return (
                      <button
                        key={product.id || product.sku || product.name}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-m-surface-2"
                        onClick={() => selectProduct(product)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-m-text">
                            {product.name || product.sku || t("unnamedProduct")}
                          </div>
                          <div className="truncate text-[11px] text-m-text-muted">
                            {product.sku || "--"}
                            {price ? ` · ${price}` : ""}
                          </div>
                        </div>
                        <Badge variant="primary" size="sm">
                          {t("actions.select")}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <FormField>
              <Label>{t("frequencyLabel")}</Label>
              <Select
                value={form.frequency}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    frequency: event.target.value as SubscriptionFrequency
                  }))
                }
                options={FREQUENCY_OPTIONS.map((frequency) => ({
                  value: frequency,
                  label: t(`frequency.${frequency}`)
                }))}
              />
            </FormField>
            <FormField>
              <Label>{t("startDate")}</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startDate: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label>{calendarT("scheduleTime")}</Label>
              <Input
                type="time"
                value={form.scheduleTime}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, scheduleTime: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label required>{t("columns.nextDelivery")}</Label>
              <Input
                type="date"
                value={form.nextDeliveryDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, nextDeliveryDate: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label>{t("endDate")}</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endDate: event.target.value }))
                }
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField>
              <Label>{t("columns.status")}</Label>
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value as SubscriptionStatus
                  }))
                }
                options={STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: t(`status.${status}`)
                }))}
              />
            </FormField>
            <FormField>
              <Label required>{t("authorizedPayment")}</Label>
              <Input
                value={form.paymentMethod}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))
                }
              />
            </FormField>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label required>{t("deliveryAddress")}</Label>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Icon name="plus" size="xs" />}
                onClick={() => {
                  setAddressError("");
                  setShowNewAddress((visible) => !visible);
                }}
                disabled={!form.customerId}
              >
                {t("addNewAddress")}
              </Button>
            </div>

            {!form.customerId ? (
              <div className="rounded-m-lg border border-dashed border-m-border px-3 py-3 text-xs text-m-text-muted">
                {t("selectCustomerForAddresses")}
              </div>
            ) : addressesLoading ? (
              <div className="rounded-m-lg border border-m-border px-3 py-3 text-xs text-m-text-muted">
                {t("loadingAddresses")}
              </div>
            ) : savedAddresses.length === 0 ? (
              <div className="rounded-m-lg border border-dashed border-m-border px-3 py-3 text-xs text-m-text-muted">
                {t("noSavedAddresses")}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {savedAddresses.map((address) => {
                  const selected = form.shippingAddress === formatAddress(address);
                  const isDefault = address.id === addressesData?.customerAddresses.defaultShippingAddressId;
                  return (
                    <button
                      key={address.id}
                      type="button"
                      className={`relative min-h-24 rounded-m-lg border p-3 text-left transition-colors ${
                        selected
                          ? "border-m-primary bg-m-primary-light/40"
                          : "border-m-border bg-m-surface hover:bg-m-surface-2"
                      }`}
                      onClick={() => selectAddress(address)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="whitespace-pre-line text-xs font-medium leading-5 text-m-text">
                          {formatAddress(address)}
                        </div>
                        {selected && <Icon name="check" size="sm" className="shrink-0 text-m-primary" />}
                      </div>
                      {isDefault && (
                        <div className="mt-2 text-[11px] font-semibold text-m-primary">
                          {t("defaultShippingAddress")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {showNewAddress && (
              <div className="border-t border-m-border pt-4">
                <div className="mb-3 text-sm font-bold text-m-text">{t("addNewAddress")}</div>
                {addressError && (
                  <div className="mb-3 rounded-m-md border border-m-error-border bg-m-error-light px-3 py-2 text-xs font-semibold text-m-error">
                    {addressError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField>
                    <Label required>{t("streetName")}</Label>
                    <Input
                      value={newAddress.streetName}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, streetName: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField>
                    <Label>{t("streetNumber")}</Label>
                    <Input
                      value={newAddress.streetNumber}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, streetNumber: event.target.value }))
                      }
                    />
                  </FormField>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField>
                    <Label required>{t("city")}</Label>
                    <Input
                      value={newAddress.city}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, city: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField>
                    <Label>{t("state")}</Label>
                    <Input
                      value={newAddress.state}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, state: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField>
                    <Label required>{t("postalCode")}</Label>
                    <Input
                      value={newAddress.postalCode}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, postalCode: event.target.value }))
                      }
                    />
                  </FormField>
                </div>
                <div className="mt-4">
                  <FormField>
                    <Label required>{t("country")}</Label>
                    <Select
                      value={newAddress.country}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, country: event.target.value }))
                      }
                      options={countryOptions}
                    />
                  </FormField>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddressError("");
                      setNewAddress(emptyNewAddress());
                      setShowNewAddress(false);
                    }}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => void saveNewAddress()} loading={addingAddress}>
                    {t("saveAddress")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField>
              <Label>{t("specialPricing")}</Label>
              <Input
                value={form.discountLabel}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, discountLabel: event.target.value }))
                }
                placeholder={t("discountPlaceholder")}
              />
            </FormField>
            <FormField>
              <Label>{t("approvedPriceOverride")}</Label>
              <Input
                value={form.priceOverride}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, priceOverride: event.target.value }))
                }
                placeholder={t("overridePlaceholder")}
              />
            </FormField>
          </div>

          {editing && (
            <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                {t("changeHistory")}
              </div>
              <div className="space-y-2">
                {editing.history.slice(0, 5).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-m-text">{entry.action}</div>
                      {entry.note && (
                        <div className="text-m-text-muted">{entry.note}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-m-text-muted">
                      {formatDateTime(entry.createdAt, locale)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
            {t("actions.cancel")}
          </Button>
          <Button variant="primary" onClick={saveSubscription}>
            {editing ? t("saveChanges") : t("createTitle")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
