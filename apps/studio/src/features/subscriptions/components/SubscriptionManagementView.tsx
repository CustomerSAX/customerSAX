"use client";

import { gql, useMutation, useQuery } from "@apollo/client";
import { useEffect, useMemo, useRef, useState } from "react";
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

const ADDRESS_COUNTRY_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "AU", label: "Australia" },
  { value: "IN", label: "India" },
  { value: "NZ", label: "New Zealand" }
];

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
  nextDeliveryDate: string;
  endDate: string;
  shippingAddress: string;
  paymentMethod: string;
  currencyCode: string;
  discountLabel: string;
  priceOverride: string;
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
  customerContext?: SubscriptionManagementViewProps["customerContext"]
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
    nextDeliveryDate: nextMonth(),
    endDate: "",
    shippingAddress: customerContext?.defaultAddress ?? "",
    paymentMethod: "Authorized card on file",
    currencyCode: "",
    discountLabel: "",
    priceOverride: ""
  };
}

function formFromSubscription(subscription: CustomerSubscription): FormState {
  const item = subscription.lineItems[0];
  return {
    ownerType: subscription.ownerType,
    customerId: subscription.customerId ?? "",
    customerName: subscription.customerName,
    customerEmail: subscription.customerEmail,
    businessAccountName: subscription.businessAccountName ?? "",
    status: subscription.status,
    productName: item?.name ?? "",
    sku: item?.sku ?? "",
    quantity: String(item?.quantity ?? 1),
    unitPrice: String(item?.unitPrice ?? ""),
    frequency: subscription.frequency,
    startDate: subscription.startDate,
    nextDeliveryDate: subscription.nextDeliveryDate,
    endDate: subscription.endDate ?? "",
    shippingAddress: subscription.shippingAddress,
    paymentMethod: subscription.paymentMethod,
    currencyCode: subscription.currencyCode,
    discountLabel: subscription.discountLabel ?? "",
    priceOverride: subscription.priceOverride ?? ""
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
    nextDeliveryDate: form.nextDeliveryDate,
    endDate: form.endDate || undefined,
    shippingAddress: form.shippingAddress.trim(),
    paymentMethod: form.paymentMethod.trim(),
    currencyCode: form.currencyCode,
    discountLabel: form.discountLabel.trim() || undefined,
    priceOverride: form.priceOverride.trim() || undefined,
    lastOrderNumber: undefined,
    lineItems: [
      {
        id: "line-1",
        sku: form.sku.trim(),
        name: form.productName.trim() || form.sku.trim(),
        quantity: Math.max(1, Number(form.quantity) || 1),
        unitPrice: Math.max(0, Number(form.unitPrice) || 0)
      }
    ]
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

function money(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
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
  const [form, setForm] = useState<FormState>(() => emptyForm(customerContext));
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
        : `${currencyCode} (legacy)`
    }));
  }, [availableCurrencies, form.currencyCode]);

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
          throw new Error(payload.error || "Unable to search customers.");
        }
        if (!cancelled) {
          setCustomerSearchResults(payload.results ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setCustomerSearchResults([]);
          setCustomerSearchError(
            error instanceof Error ? error.message : "Unable to search customers."
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
  }, [customerContext, customerSearchText, editing, form.ownerType]);

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
          throw new Error(payload.error || "Unable to search products.");
        }
        if (!cancelled) {
          setProductSearchResults(payload.results ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setProductSearchResults([]);
          setProductSearchError(
            error instanceof Error ? error.message : "Unable to search products."
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
  }, [productSearchOpen, productSearchText]);

  const filteredSubscriptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      if (statusFilter !== "all" && subscription.status !== statusFilter) return false;
      if (!needle) return true;
      const firstItem = subscription.lineItems[0];
      return [
        subscription.subscriptionNumber,
        subscription.customerName,
        subscription.customerEmail,
        subscription.businessAccountName,
        subscription.status,
        firstItem?.sku,
        firstItem?.name
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
    setForm(emptyForm(customerContext));
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
      setAddressError("Select a customer before adding an address.");
      return;
    }
    if (
      !newAddress.streetName.trim() ||
      !newAddress.city.trim() ||
      !newAddress.postalCode.trim() ||
      !newAddress.country
    ) {
      setAddressError("Street, city, postal code and country are required.");
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
        error instanceof Error ? error.message : "Unable to add the customer address."
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
      setFormError("Customer name and email are required.");
      return;
    }
    if (!form.sku.trim()) {
      setFormError("SKU is required.");
      return;
    }
    if (!form.currencyCode) {
      setFormError("Select a currency configured for this commercetools project.");
      return;
    }
    if (
      !form.nextDeliveryDate ||
      !form.shippingAddress.trim() ||
      !form.paymentMethod.trim()
    ) {
      setFormError(
        "Next delivery, shipping address and authorized payment method are required."
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
        error instanceof Error ? error.message : "Unable to save the subscription."
      );
    }
  };

  const cancelSubscription = async (subscription: CustomerSubscription) => {
    const reason = window.prompt("Cancellation reason");
    if (reason == null) return;
    await changeStatus(subscription.id, "Cancelled", reason.trim() || "No reason provided");
  };

  const renderActions = (subscription: CustomerSubscription) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="ghost" size="sm" onClick={() => openView(subscription)}>
        View
      </Button>
      <Button variant="ghost" size="sm" onClick={() => openEdit(subscription)}>
        Edit
      </Button>
      {subscription.status === "Active" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void changeStatus(subscription.id, "On Hold", "Put on hold by agent")}
          >
            Hold
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void skipNextCycle(subscription.id)}
          >
            Skip
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void cancelSubscription(subscription)}
          >
            Cancel
          </Button>
        </>
      )}
      {(subscription.status === "Paused" || subscription.status === "On Hold") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void changeStatus(subscription.id, "Active", "Resumed by agent")}
        >
          Resume
        </Button>
      )}
      {subscription.status === "Draft" && (
        <Button variant="ghost" size="sm" onClick={() => void deleteDraft(subscription.id)}>
          Delete Draft
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {!embedded && (
        <PageHeader
          title="Subscriptions"
          subtitle="Create and manage recurring purchases for B2C customers."
          breadcrumbs={
            <span className="text-xs font-medium uppercase tracking-widest text-m-text-muted">
              Commerce
            </span>
          }
          actions={
            <Button
              variant="primary"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={openCreate}
            >
              New Subscription
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel title="Active">
          <div className="p-4 text-2xl font-bold text-m-text">{counts.active}</div>
        </Panel>
        <Panel title="Paused / On Hold">
          <div className="p-4 text-2xl font-bold text-m-text">{counts.paused}</div>
        </Panel>
        <Panel title="Drafts">
          <div className="p-4 text-2xl font-bold text-m-text">{counts.draft}</div>
        </Panel>
      </div>

      <Panel
        title={embedded ? "Subscriptions" : "Subscription Management"}
        headerActions={
          embedded ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={openCreate}
            >
              New Subscription
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
              placeholder="Search by subscription, customer, product or SKU..."
            />
          </div>
          <div className="w-full md:w-52">
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | SubscriptionStatus)
              }
              options={[
                { value: "all", label: "All statuses" },
                ...STATUS_OPTIONS.map((status) => ({ value: status, label: status }))
              ]}
            />
          </div>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <CardEmpty
            icon="repeat"
            title="No subscriptions found"
            hint={
              customerContext
                ? "Create a recurring purchase for this customer."
                : "Create the first customer subscription."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscription</TableHead>
                {!customerContext && <TableHead>Customer</TableHead>}
                <TableHead>Created By</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Next Delivery</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.map((subscription) => {
                const firstItem = subscription.lineItems[0];
                return (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="font-mono text-xs font-bold text-m-primary">
                        {subscription.subscriptionNumber}
                      </div>
                      <div className="text-[11px] text-m-text-muted">
                        Updated {formatDateTime(subscription.updatedAt)}
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
                      <div className="font-semibold text-m-text">
                        {firstItem?.name || "--"}
                      </div>
                      <div className="text-[11px] text-m-text-muted">
                        {firstItem?.sku || "--"} × {firstItem?.quantity ?? 0}
                      </div>
                    </TableCell>
                    <TableCell>{subscription.frequency}</TableCell>
                    <TableCell>{formatDate(subscription.nextDeliveryDate)}</TableCell>
                    <TableCell>
                      <div className="font-semibold">
                        {money(
                          subscriptionTotal(subscription),
                          subscription.currencyCode
                        )}
                      </div>
                      {subscription.discountLabel && (
                        <div className="text-[11px] text-m-success">
                          {subscription.discountLabel}
                        </div>
                      )}
                      {subscription.priceOverride && (
                        <Badge variant="warning" size="sm">
                          Override
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={statusTone(subscription.status)}>
                        {subscription.status}
                      </StatusPill>
                    </TableCell>
                    <TableCell>{renderActions(subscription)}</TableCell>
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
              title={`Subscription ${viewing.subscriptionNumber}`}
              subtitle="Recurring purchase details, linked orders and change history."
              onClose={() => setViewing(null)}
            />
            <Modal.Body>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    Status
                  </div>
                  <div className="mt-2">
                    <StatusPill tone={statusTone(viewing.status)}>
                      {viewing.status}
                    </StatusPill>
                  </div>
                </div>
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    Frequency
                  </div>
                  <div className="mt-2 text-sm font-semibold text-m-text">
                    {viewing.frequency}
                  </div>
                </div>
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    Next Delivery
                  </div>
                  <div className="mt-2 text-sm font-semibold text-m-text">
                    {formatDate(viewing.nextDeliveryDate)}
                  </div>
                </div>
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                    Recurring Price
                  </div>
                  <div className="mt-2 text-sm font-semibold text-m-text">
                    {money(subscriptionTotal(viewing), viewing.currencyCode)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    Customer
                  </div>
                  <div className="text-sm font-semibold text-m-text">
                    {viewing.customerName}
                  </div>
                  <div className="mt-1 text-xs text-m-text-muted">
                    {viewing.customerEmail}
                  </div>
                  {viewing.businessAccountName && (
                    <div className="mt-3 text-xs text-m-text">
                      Account:{" "}
                      <span className="font-semibold">
                        {viewing.businessAccountName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    Schedule
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-m-text-muted">Start Date</div>
                      <div className="font-semibold text-m-text">
                        {formatDate(viewing.startDate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-m-text-muted">End Date</div>
                      <div className="font-semibold text-m-text">
                        {viewing.endDate ? formatDate(viewing.endDate) : "Open ended"}
                      </div>
                    </div>
                    <div>
                      <div className="text-m-text-muted">Payment</div>
                      <div className="font-semibold text-m-text">
                        {viewing.paymentMethod}
                      </div>
                    </div>
                    <div>
                      <div className="text-m-text-muted">Currency</div>
                      <div className="font-semibold text-m-text">
                        {viewing.currencyCode}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                  Products
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
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
                        <TableCell>{money(item.unitPrice, viewing.currencyCode)}</TableCell>
                        <TableCell className="font-semibold">
                          {money(item.unitPrice * item.quantity, viewing.currencyCode)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    Delivery Address
                  </div>
                  <div className="whitespace-pre-wrap text-xs font-medium text-m-text">
                    {viewing.shippingAddress}
                  </div>
                </div>

                <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                    Pricing Controls
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-m-text-muted">Discount: </span>
                      <span className="font-semibold text-m-text">
                        {viewing.discountLabel || "None"}
                      </span>
                    </div>
                    <div>
                      <span className="text-m-text-muted">Price override: </span>
                      <span className="font-semibold text-m-text">
                        {viewing.priceOverride || "None"}
                      </span>
                    </div>
                    {viewing.cancellationReason && (
                      <div>
                        <span className="text-m-text-muted">Cancellation reason: </span>
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
                  Linked Orders
                </div>
                {viewing.linkedOrderNumbers.length === 0 ? (
                  <div className="text-xs text-m-text-muted">No linked orders yet.</div>
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
                  Change History
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
                        {formatDateTime(entry.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => openEdit(viewing)}>
                Edit Details
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl">
        <Modal.Header
          title={editing ? `Edit ${editing.subscriptionNumber}` : "Create Subscription"}
          subtitle="Recurring purchase terms for future cycles. Existing orders are not amended here."
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
              <Label>Owner Type</Label>
              <Select
                value={form.ownerType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    ownerType: event.target.value as "B2C" | "B2B"
                  }))
                }
                options={[
                  { value: "B2C", label: "B2C Customer" },
                  { value: "B2B", label: "B2B Account" }
                ]}
                disabled={Boolean(customerContext)}
              />
            </FormField>
            <FormField>
              <Label required>Customer Name</Label>
              <Input
                value={form.customerName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, customerName: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label required>Customer Email</Label>
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
                  Customer search
                </div>
                {customerSearchLoading && (
                  <div className="text-[11px] font-medium text-m-text-muted">
                    Searching…
                  </div>
                )}
              </div>
              {customerSearchError ? (
                <div className="px-3 py-2 text-xs font-semibold text-m-error">
                  {customerSearchError}
                </div>
              ) : customerSearchText.trim().length < 2 ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  Type a customer name or email to search existing customers.
                </div>
              ) : customerSearchResults.length === 0 && !customerSearchLoading ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  No matching customers found.
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
                        Select
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.ownerType === "B2B" && (
            <FormField>
              <Label>Business Account</Label>
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
              <Label>Product Name</Label>
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
              <Label>Quantity</Label>
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
              <Label required>Currency</Label>
              <Select
                value={form.currencyCode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, currencyCode: event.target.value }))
                }
                disabled={currenciesLoading || currencyOptions.length === 0}
                options={
                  currenciesLoading
                    ? [{ value: "", label: "Loading currencies..." }]
                    : currencyOptions.length > 0
                      ? currencyOptions
                      : [{ value: "", label: "No currencies configured" }]
                }
              />
            </FormField>
            <FormField>
              <Label>Unit Price</Label>
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
                  No catalog price is available in {form.currencyCode}.
                </div>
              )}
            </FormField>
          </div>

          {productSearchOpen && (
            <div className="rounded-m-lg border border-m-border bg-m-surface-1">
              <div className="flex items-center justify-between gap-3 border-b border-m-border/70 px-3 py-2">
                <div className="text-xs font-semibold text-m-text">SKU search</div>
                {productSearchLoading && (
                  <div className="text-[11px] font-medium text-m-text-muted">
                    Searching…
                  </div>
                )}
              </div>
              {productSearchError ? (
                <div className="px-3 py-2 text-xs font-semibold text-m-error">
                  {productSearchError}
                </div>
              ) : productSearchText.trim().length < 2 ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  Type a SKU or product name to search catalog products.
                </div>
              ) : productSearchResults.length === 0 && !productSearchLoading ? (
                <div className="px-3 py-2 text-xs text-m-text-muted">
                  No matching products found.
                </div>
              ) : (
                <div className="divide-y divide-m-border/70">
                  {productSearchResults.map((product) => {
                    const price =
                      typeof product.price?.centAmount === "number"
                        ? money(
                            product.price.centAmount /
                              10 ** (product.price.fractionDigits ?? 2),
                            product.price.currencyCode || form.currencyCode
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
                            {product.name || product.sku || "Unnamed product"}
                          </div>
                          <div className="truncate text-[11px] text-m-text-muted">
                            {product.sku || "--"}
                            {price ? ` · ${price}` : ""}
                          </div>
                        </div>
                        <Badge variant="primary" size="sm">
                          Select
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <FormField>
              <Label>Frequency</Label>
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
                  label: frequency
                }))}
              />
            </FormField>
            <FormField>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startDate: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label required>Next Delivery</Label>
              <Input
                type="date"
                value={form.nextDeliveryDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, nextDeliveryDate: event.target.value }))
                }
              />
            </FormField>
            <FormField>
              <Label>End Date</Label>
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
              <Label>Status</Label>
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
                  label: status
                }))}
              />
            </FormField>
            <FormField>
              <Label required>Authorized Payment</Label>
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
              <Label required>Delivery Address</Label>
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
                Add New Address
              </Button>
            </div>

            {!form.customerId ? (
              <div className="rounded-m-lg border border-dashed border-m-border px-3 py-3 text-xs text-m-text-muted">
                Select a customer to load their saved delivery addresses.
              </div>
            ) : addressesLoading ? (
              <div className="rounded-m-lg border border-m-border px-3 py-3 text-xs text-m-text-muted">
                Loading customer addresses...
              </div>
            ) : savedAddresses.length === 0 ? (
              <div className="rounded-m-lg border border-dashed border-m-border px-3 py-3 text-xs text-m-text-muted">
                This customer has no saved shipping addresses. Add one to continue.
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
                          Default shipping address
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {showNewAddress && (
              <div className="border-t border-m-border pt-4">
                <div className="mb-3 text-sm font-bold text-m-text">Add New Address</div>
                {addressError && (
                  <div className="mb-3 rounded-m-md border border-m-error-border bg-m-error-light px-3 py-2 text-xs font-semibold text-m-error">
                    {addressError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField>
                    <Label required>Street Name</Label>
                    <Input
                      value={newAddress.streetName}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, streetName: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField>
                    <Label>Street Number</Label>
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
                    <Label required>City</Label>
                    <Input
                      value={newAddress.city}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, city: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField>
                    <Label>State</Label>
                    <Input
                      value={newAddress.state}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, state: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField>
                    <Label required>Postal Code</Label>
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
                    <Label required>Country</Label>
                    <Select
                      value={newAddress.country}
                      onChange={(event) =>
                        setNewAddress((previous) => ({ ...previous, country: event.target.value }))
                      }
                      options={ADDRESS_COUNTRY_OPTIONS}
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
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => void saveNewAddress()} loading={addingAddress}>
                    Save Address
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField>
              <Label>Special Pricing / Discount</Label>
              <Input
                value={form.discountLabel}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, discountLabel: event.target.value }))
                }
                placeholder="10% subscription discount"
              />
            </FormField>
            <FormField>
              <Label>Approved Price Override</Label>
              <Input
                value={form.priceOverride}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, priceOverride: event.target.value }))
                }
                placeholder="Approved offer reference"
              />
            </FormField>
          </div>

          {editing && (
            <div className="rounded-m-lg border border-m-border bg-m-surface-1 p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-m-text-muted">
                Change History
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
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveSubscription}>
            {editing ? "Save Changes" : "Create Subscription"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
