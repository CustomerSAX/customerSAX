"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "@apollo/client";
import { CUSTOMER_ORDERS_QUERY, CUSTOMER_CARTS_QUERY, CUSTOMER_ADDRESSES_QUERY } from "../../orders/api/queries";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Avatar,
  Icon,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Select,
  SearchBar,
  Modal,
  FormField,
  Label,
} from "@csa/ui";
import { formatDate, formatDateTime } from "@/lib/format-date";
import {
  DetailPage,
  BackLink,
  EntityHeader,
  EntityTabs,
  type EntityTab,
  SummaryGrid,
  SummaryCard,
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  CardAction,
  InfoList,
  InfoRow,
  StatusPill,
  type StatusTone,
  QuickActions,
  QuickAction,
  PrimaryButton,
  MoreActionsMenu,
  CardEmpty,
} from "@/components/detail";
import { useCustomerStore } from "../hooks/use-customers";
import type {
  CustomerAddress,
  CustomerCart,
  CustomerOrder,
  CustomerReturn,
  CustomerQuote,
  CustomerPayment,
  CustomerTicket,
  CustomerMessage,
  CustomerPromotion,
  PromotionUsage,
} from "../types/customer-types";

interface CustomerDetailViewProps {
  id: string;
}

const COUNTRY_OPTIONS = [
  { value: "US", label: "United States (USD)" },
  { value: "CA", label: "Canada (CAD)" },
  { value: "GB", label: "United Kingdom (GBP)" },
  { value: "DE", label: "Germany (EUR)" },
  { value: "FR", label: "France (EUR)" },
  { value: "AU", label: "Australia (AUD)" },
  { value: "JP", label: "Japan (JPY)" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
];

const CUSTOMER_TABS: EntityTab[] = [
  { id: "overview", label: "Overview", icon: "user" },
  { id: "orders", label: "Orders", icon: "shopping-bag" },
  { id: "returns", label: "Returns", icon: "rotate-ccw" },
  { id: "payments", label: "Payments", icon: "credit-card" },
  { id: "conversations", label: "Conversations", icon: "message-square" },
  { id: "notes", label: "Notes", icon: "file-text" },
];

function orderStateTone(state: string): StatusTone {
  switch (state) {
    case "Complete":
    case "Delivered":
      return "success";
    case "Confirmed":
    case "Processing":
      return "warning";
    case "Cancelled":
      return "error";
    case "Open":
      return "info";
    default:
      return "neutral";
  }
}

function paymentStateTone(state: string): StatusTone {
  switch (state) {
    case "Paid":
    case "Success":
      return "success";
    case "Pending":
      return "warning";
    case "BalanceDue":
    case "Failed":
      return "error";
    default:
      return "neutral";
  }
}

function ticketStatusTone(status: string): StatusTone {
  switch (status) {
    case "Resolved":
    case "Closed":
      return "success";
    case "In Progress":
      return "info";
    case "Open":
      return "warning";
    default:
      return "neutral";
  }
}

function ticketPriorityTone(priority: string): StatusTone {
  switch (priority) {
    case "Urgent":
    case "High":
      return "error";
    case "Medium":
      return "warning";
    default:
      return "neutral";
  }
}

export function CustomerDetailView({ id }: CustomerDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const { customers, groups, getCustomerById, updateCustomerProfile, loading, error } = useCustomerStore();

  // ── Real orders from BFF (filtered by this customer's ID) ─────────────────
  type GqlMoney = { centAmount: number; currencyCode: string; fractionDigits: number };
  type GqlReturnItem = { id: string; type?: string | null; quantity: number; lineItemId?: string | null; shipmentState: string; paymentState: string; comment?: string | null };
  type GqlReturnInfo = { returnTrackingId?: string | null; returnDate?: string | null; items: GqlReturnItem[] };
  type GqlOrderRow = {
    id: string;
    orderNumber?: string | null;
    orderState?: string | null;
    paymentState?: string | null;
    createdAt?: string | null;
    totalPrice?: GqlMoney | null;
    lineItems?: Array<{ id: string }> | null;
    returnInfo?: GqlReturnInfo[] | null;
  };
  const { data: ordersGqlData, loading: ordersLoading } = useQuery<{
    orderPage: { total: number; results: GqlOrderRow[] };
  }>(CUSTOMER_ORDERS_QUERY, {
    variables: { customerId: id, limit: 100 },
  });

  // ── Real carts from BFF (filtered by customerId) ──────────────────────────
  type GqlCartLineItem = { id: string; name?: string | null; quantity: number };
  type GqlCart = { id: string; key?: string | null; currencyCode: string; totalPrice: GqlMoney; lineItems: GqlCartLineItem[] };
  const { data: cartsGqlData } = useQuery<{
    b2bCarts: { total: number; results: GqlCart[] };
  }>(CUSTOMER_CARTS_QUERY, {
    variables: { customerId: id, limit: 50 },
  });

  // ── Real addresses from CT via BFF (includes default IDs) ────────────────
  type CtAddrRaw = { id: string; streetName?: string | null; streetNumber?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null; phone?: string | null; email?: string | null };
  type CustomerAddressesResult = { addresses: CtAddrRaw[]; defaultShippingAddressId: string | null; defaultBillingAddressId: string | null; shippingAddressIds: string[]; billingAddressIds: string[] };
  const { data: addressesGqlData } = useQuery<{ customerAddresses: CustomerAddressesResult }>(
    CUSTOMER_ADDRESSES_QUERY,
    { variables: { id } }
  );

  // ── Real tickets from ticketing service (by customerEmail) ────────────────
  const [realTickets, setRealTickets] = useState<CustomerTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const customer = getCustomerById(id) || customers[0];

  const fetchCustomerTickets = useCallback(async (email: string) => {
    setTicketsLoading(true);
    try {
      const res = await fetch(`/api/tickets?customerEmail=${encodeURIComponent(email)}&limit=100`);
      if (!res.ok) return;
      const json = await res.json() as {
        results: Array<{ id: string; ticketNumber: string; subject: string; status: string; priority: string; createdAt?: string }>;
      };
      setRealTickets(
        (json.results ?? []).map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          status: (t.status as CustomerTicket["status"]) ?? "Open",
          priority: (t.priority as CustomerTicket["priority"]) ?? "Medium",
          createdAt: formatDateTime(t.createdAt),
        }))
      );
    } catch {
      /* silently ignore — tickets tab will show empty */
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (customer?.email) void fetchCustomerTickets(customer.email);
  }, [customer?.email, fetchCustomerTickets]);

  // Map BFF orders to the CustomerOrder shape used in tabs / metrics
  function formatMoney(m?: GqlMoney | null): string {
    if (!m) return "--";
    const amt = m.centAmount / Math.pow(10, m.fractionDigits ?? 2);
    return `${m.currencyCode} ${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const realOrders: CustomerOrder[] = useMemo(
    () =>
      (ordersGqlData?.orderPage.results ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber ?? o.id,
        orderState: o.orderState ?? "Open",
        paymentState: o.paymentState ?? "Pending",
        totalPrice: formatMoney(o.totalPrice),
        itemsCount: o.lineItems?.length ?? 0,
        createdAt: formatDate(o.createdAt),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordersGqlData]
  );

  const totalOrderCount = ordersGqlData?.orderPage.total ?? realOrders.length;

  const totalSpend = useMemo(() => {
    const rows = ordersGqlData?.orderPage.results ?? [];
    if (rows.length === 0) return "--";
    let sum = 0;
    let currency = "USD";
    let fraction = 2;
    for (const o of rows) {
      if (o.totalPrice) {
        sum += o.totalPrice.centAmount;
        currency = o.totalPrice.currencyCode;
        fraction = o.totalPrice.fractionDigits ?? 2;
      }
    }
    const amt = sum / Math.pow(10, fraction);
    return `${currency} ${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [ordersGqlData]);

  // Derive returns from orders that carry returnInfo
  const realReturns: CustomerReturn[] = useMemo(() => {
    const results: CustomerReturn[] = [];
    for (const o of ordersGqlData?.orderPage.results ?? []) {
      if (!o.returnInfo?.length) continue;
      for (const ri of o.returnInfo) {
        results.push({
          id: ri.returnTrackingId ?? `${o.id}-${results.length}`,
          orderNumber: o.orderNumber ?? o.id,
          returnTrackingId: ri.returnTrackingId ?? "--",
          returnDate: formatDate(ri.returnDate),
          itemsCount: ri.items?.length ?? 0,
          items: (ri.items ?? []).map((item) => ({
            id: item.id,
            quantity: item.quantity,
            shipmentState: item.shipmentState,
            paymentState: item.paymentState,
            createdAt: "--",
            comment: item.comment ?? undefined,
          })),
        });
      }
    }
    return results;

  }, [ordersGqlData]);

  // Real carts from BFF
  const realCarts: CustomerCart[] = useMemo(
    () =>
      (cartsGqlData?.b2bCarts.results ?? []).map((c) => ({
        id: c.id,
        cartState: "Active",
        orderNumber: "--",
        totalPrice: formatMoney(c.totalPrice),
        lineItemsCount: c.lineItems?.length ?? 0,
        createdAt: "--",
        currency: c.currencyCode,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartsGqlData]
  );

  const totalCartsCount = cartsGqlData?.b2bCarts.total ?? realCarts.length;

  // Real addresses from CT — derive CustomerAddress[] with default flags
  const realAddresses: CustomerAddress[] = useMemo(() => {
    const raw = addressesGqlData?.customerAddresses;
    if (!raw?.addresses?.length) return [];
    const { defaultShippingAddressId, defaultBillingAddressId, shippingAddressIds, billingAddressIds } = raw;
    return raw.addresses.map((a) => ({
      id: a.id,
      streetName: a.streetName ?? "",
      streetNumber: a.streetNumber ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      postalCode: a.postalCode ?? "",
      country: a.country ?? "",
      email: a.email ?? customer?.email ?? "",
      phone: a.phone ?? "",
      isShipping: shippingAddressIds?.includes(a.id) ?? false,
      isBilling: billingAddressIds?.includes(a.id) ?? false,
      isDefaultShipping: defaultShippingAddressId === a.id,
      isDefaultBilling: defaultBillingAddressId === a.id,
    }));

  }, [addressesGqlData, customer?.email]);

  // Local state for tabs and features
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profile Form state
  const [profileFirstName, setProfileFirstName] = useState(customer?.firstName || "");
  const [profileLastName, setProfileLastName] = useState(customer?.lastName || "");
  const [profileEmail, setProfileEmail] = useState(customer?.email || "");
  const [profilePhone, setProfilePhone] = useState(customer?.phone || "");
  const [profileCompany, setProfileCompany] = useState(customer?.companyName || "");
  const [profileGroup, setProfileGroup] = useState(customer?.customerGroup?.id || "grp-vip");
  const [profileSavedMsg, setProfileSavedMsg] = useState("");

  useEffect(() => {
    if (!customer) return;

    setProfileFirstName(customer.firstName || "");
    setProfileLastName(customer.lastName || "");
    setProfileEmail(customer.email || "");
    setProfilePhone(customer.phone || "");
    setProfileCompany(customer.companyName || "");
    setProfileGroup(customer.customerGroup?.id || "grp-vip");
  }, [customer]);

  // Addresses State — seeded empty, synced from real CT data via realAddresses memo
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  // Sync real addresses from CT whenever the query resolves
  useEffect(() => {
    if (realAddresses.length > 0) setAddresses(realAddresses);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressesGqlData]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrStreetName, setAddrStreetName] = useState("");
  const [addrStreetNumber, setAddrStreetNumber] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrCountry, setAddrCountry] = useState("US");
  const [addrEmail, setAddrEmail] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrIsShipping, setAddrIsShipping] = useState(true);
  const [addrIsBilling, setAddrIsBilling] = useState(false);
  const [addrIsDefaultShip, setAddrIsDefaultShip] = useState(false);
  const [addrIsDefaultBill, setAddrIsDefaultBill] = useState(false);
  const [deleteConfirmAddrId, setDeleteConfirmAddrId] = useState<string | null>(null);

  // Carts State — seeded from real CT carts, agent-created carts are prepended
  const [agentCreatedCarts, setAgentCreatedCarts] = useState<CustomerCart[]>([]);
  const carts = [...agentCreatedCarts, ...realCarts];
  const [cartCountry, setCartCountry] = useState("US");
  const [cartCurrency, setCartCurrency] = useState("USD");
  const [showOrderBehalfPanel, setShowOrderBehalfPanel] = useState(false);

  // Orders State — derived from real BFF data (see realOrders above)
  const orders = realOrders;
  const [ordersSearch, setOrdersSearch] = useState("");

  // Returns State — derived from realReturns extracted from order returnInfo
  const returns = realReturns;
  const [returnsSearch, setReturnsSearch] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<CustomerReturn | null>(null);

  // Quotes State — no real customer-level quotes API; start empty
  const [quotes] = useState<CustomerQuote[]>([]);

  // Payments State — no real customer-level payment API; start empty
  const [payments] = useState<CustomerPayment[]>([]);

  // Tickets State — sourced from realTickets fetched by customerEmail (above)
  const tickets = realTickets;
  const [ticketsSearch, setTicketsSearch] = useState("");

  // Messages State — no real messaging backend; starts empty for agents to type fresh replies
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState("");

  // Password Reset State
  const [passwordResetStatus, setPasswordResetStatus] = useState<"" | "sending" | "sent">("");

  // Promotions State — no real promotion-per-customer API; starts empty
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [couponFeedback, setCouponFeedback] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [assignedPromotions, setAssignedPromotions] = useState<CustomerPromotion[]>([]);
  const [availablePromotions] = useState<CustomerPromotion[]>([]);
  const [promotionUsages] = useState<PromotionUsage[]>([]);

  // Handlers
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const selGroup = groups.find((g) => g.id === profileGroup);
    updateCustomerProfile(customer.id, {
      firstName: profileFirstName,
      lastName: profileLastName,
      email: profileEmail,
      phone: profilePhone,
      companyName: profileCompany,
      customerGroup: selGroup ? { id: selGroup.id, name: selGroup.name, key: selGroup.key } : undefined,
    });
    setProfileSavedMsg("Customer profile saved successfully.");
    setTimeout(() => setProfileSavedMsg(""), 3000);
  };

  const handleCreateCart = () => {
    const newCart: CustomerCart = {
      id: `CRT-${Math.floor(100 + Math.random() * 900)}`,
      cartState: "Active",
      orderNumber: "--",
      totalPrice: "$0.00",
      lineItemsCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      currency: cartCurrency,
      country: cartCountry,
    };
    setAgentCreatedCarts((prev) => [newCart, ...prev]);
    setShowOrderBehalfPanel(false);
  };

  const handleOpenAddAddress = () => {
    setEditingAddrId(null);
    setAddrStreetName("");
    setAddrStreetNumber("");
    setAddrCity("");
    setAddrState("");
    setAddrPostalCode("");
    setAddrCountry("US");
    setAddrEmail(customer?.email || "");
    setAddrPhone(customer?.phone || "");
    setAddrIsShipping(true);
    setAddrIsBilling(false);
    setAddrIsDefaultShip(false);
    setAddrIsDefaultBill(false);
    setShowAddressModal(true);
  };

  const handleOpenEditAddress = (addr: CustomerAddress) => {
    setEditingAddrId(addr.id);
    setAddrStreetName(addr.streetName || "");
    setAddrStreetNumber(addr.streetNumber || "");
    setAddrCity(addr.city || "");
    setAddrState(addr.state || "");
    setAddrPostalCode(addr.postalCode || "");
    setAddrCountry(addr.country || "US");
    setAddrEmail(addr.email || customer?.email || "");
    setAddrPhone(addr.phone || customer?.phone || "");
    setAddrIsShipping(Boolean(addr.isShipping));
    setAddrIsBilling(Boolean(addr.isBilling));
    setAddrIsDefaultShip(Boolean(addr.isDefaultShipping));
    setAddrIsDefaultBill(Boolean(addr.isDefaultBilling));
    setShowAddressModal(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAddrId) {
      setAddresses((prev) =>
        prev.map((a) =>
          a.id === editingAddrId
            ? {
                ...a,
                streetName: addrStreetName,
                streetNumber: addrStreetNumber,
                city: addrCity,
                state: addrState,
                postalCode: addrPostalCode,
                country: addrCountry,
                email: addrEmail,
                phone: addrPhone,
                isShipping: addrIsShipping,
                isBilling: addrIsBilling,
                isDefaultShipping: addrIsDefaultShip,
                isDefaultBilling: addrIsDefaultBill,
              }
            : a
        )
      );
    } else {
      const newAddr: CustomerAddress = {
        id: `addr-${Date.now()}`,
        streetName: addrStreetName,
        streetNumber: addrStreetNumber,
        city: addrCity,
        state: addrState,
        postalCode: addrPostalCode,
        country: addrCountry,
        email: addrEmail,
        phone: addrPhone,
        isShipping: addrIsShipping,
        isBilling: addrIsBilling,
        isDefaultShipping: addrIsDefaultShip,
        isDefaultBilling: addrIsDefaultBill,
      };
      setAddresses((prev) => [...prev, newAddr]);
    }
    setShowAddressModal(false);
  };

  const handleDeleteAddress = (addrId: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== addrId));
    setDeleteConfirmAddrId(null);
  };

  const handleSetDefaultShipping = (addrId: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefaultShipping: a.id === addrId,
        isShipping: a.id === addrId ? true : a.isShipping,
      }))
    );
  };

  const handleSetDefaultBilling = (addrId: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefaultBilling: a.id === addrId,
        isBilling: a.id === addrId ? true : a.isBilling,
      }))
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;
    const newMsg: CustomerMessage = {
      id: `msg-${Date.now()}`,
      sender: "agent",
      senderName: "Support Agent (John)",
      content: newMessageText.trim(),
      createdAt: formatDateTime(new Date()),
    };
    setMessages((prev) => [...prev, newMsg]);
    setNewMessageText("");
  };

  const handleSendPasswordReset = () => {
    setPasswordResetStatus("sending");
    setTimeout(() => setPasswordResetStatus("sent"), 600);
  };

  const handleValidateCoupon = () => {
    if (!couponCodeInput.trim()) {
      setCouponFeedback({ type: "error", msg: "Please enter a coupon code." });
      return;
    }
    const code = couponCodeInput.trim().toUpperCase();
    const match = availablePromotions.find((p) => p.key === code || p.name.toUpperCase().includes(code));

    if (match) {
      if (assignedPromotions.some((p) => p.id === match.id)) {
        setCouponFeedback({ type: "info", msg: `Promotion ${match.name} is already assigned.` });
      } else {
        setAssignedPromotions((prev) => [...prev, match]);
        setCouponFeedback({ type: "success", msg: `Coupon code validated! Assigned ${match.name}.` });
        setCouponCodeInput("");
      }
    } else {
      setCouponFeedback({ type: "error", msg: "Invalid or expired coupon code for this customer." });
    }
  };

  // Filtered lists
  const filteredOrders = useMemo(() => {
    if (!ordersSearch.trim()) return orders;
    const q = ordersSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.orderState.toLowerCase().includes(q) ||
        o.paymentState.toLowerCase().includes(q) ||
        o.totalPrice.toLowerCase().includes(q)
    );
  }, [orders, ordersSearch]);

  const filteredReturns = useMemo(() => {
    if (!returnsSearch.trim()) return returns;
    const q = returnsSearch.toLowerCase();
    return returns.filter(
      (r) =>
        r.orderNumber.toLowerCase().includes(q) ||
        r.returnTrackingId.toLowerCase().includes(q) ||
        r.returnDate.toLowerCase().includes(q)
    );
  }, [returns, returnsSearch]);

  const filteredTickets = useMemo(() => {
    if (!ticketsSearch.trim()) return tickets;
    const q = ticketsSearch.toLowerCase();
    return tickets.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q)
    );
  }, [tickets, ticketsSearch]);

  const defaultShippingAddress = addresses.find((a) => a.isDefaultShipping) || addresses[0];
  const defaultBillingAddress = addresses.find((a) => a.isDefaultBilling) || addresses[0];

  const customerFullName = customer?.firstName
    ? `${customer.firstName} ${customer.lastName}`
    : customer?.email || "Customer";

  const customerSince = customer?.createdAt ? formatDate(customer.createdAt) : null;

  return (
    <DetailPage>
      <BackLink href="/customers">Back to Customers</BackLink>

      <EntityHeader
        title={
          <div className="flex items-center gap-3">
            <Avatar name={customerFullName} size="lg" />
            <span>{customerFullName}</span>
          </div>
        }
        status={
          customer?.customerGroup?.name ? (
            <StatusPill tone="primary">{customer.customerGroup.name}</StatusPill>
          ) : undefined
        }
        meta={
          <>
            {customerSince ? `Customer since ${customerSince}` : "Customer since —"} • ID: {customer?.id || id}
            {customer?.customerNumber ? ` • Customer No: ${customer.customerNumber}` : ""}
          </>
        }
        actions={
          <>
            <MoreActionsMenu
              actions={[
                {
                  id: "create-ticket",
                  label: "Create Ticket",
                  icon: "plus-circle",
                  onClick: () =>
                    router.push(`/tickets/create?customerId=${customer?.id || id}&email=${customer?.email ?? ""}`),
                },
                {
                  id: "send-message",
                  label: "Send Message",
                  icon: "message-square",
                  onClick: () => setActiveTab("conversations"),
                },
                {
                  id: "password-reset",
                  label: "Send Password Reset",
                  icon: "key-round",
                  disabled: passwordResetStatus === "sending",
                  onClick: () => {
                    setActiveTab("notes");
                    handleSendPasswordReset();
                  },
                },
              ]}
            />
            <PrimaryButton icon="pencil" onClick={() => setActiveTab("overview")}>
              Edit Customer
            </PrimaryButton>
          </>
        }
      />

      {(loading || error) && (
        <div
          className={`rounded-m-lg border px-3.5 py-2.5 text-[12.5px] font-semibold ${
            error
              ? "border-m-error-border bg-m-error-light text-m-error"
              : "border-m-border bg-m-surface-2 text-m-text-muted"
          }`}
        >
          {error
            ? "Unable to load this customer from the BFF. Showing available local customer state."
            : "Loading customer data from the BFF..."}
        </div>
      )}

      <EntityTabs tabs={CUSTOMER_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        <SummaryGrid>
          <SummaryCard icon="shopping-bag" label="Total Orders" value={ordersLoading ? "…" : totalOrderCount.toString()} sub="Lifetime orders" />
          <SummaryCard
            icon="dollar-sign"
            label="Total Spend"
            value={ordersLoading ? "…" : totalSpend}
            sub={totalOrderCount > 100 ? `From first 100 of ${totalOrderCount}` : "Across fetched orders"}
          />
          <SummaryCard icon="mail" label="Email" value={customer?.email || ""} />
          <SummaryCard icon="phone" label="Phone" value={customer?.phone || ""} />
          <SummaryCard icon="calendar" label="Customer Since" value={customerSince || ""} />
          <SummaryCard icon="shopping-cart" label="Active Carts" value={totalCartsCount.toString()} tone="primary" />
        </SummaryGrid>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <>
          <ContentGrid>
            <MainColumn>
              <SectionCard title="Profile" icon="user">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {profileSavedMsg && (
                    <div className="rounded-m-md bg-m-success-light px-3 py-2 text-[12.5px] font-semibold text-m-success">
                      {profileSavedMsg}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField>
                      <Label required>First Name</Label>
                      <Input value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)} />
                    </FormField>
                    <FormField>
                      <Label required>Last Name</Label>
                      <Input value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField>
                      <Label required>Email</Label>
                      <Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
                    </FormField>
                    <FormField>
                      <Label>Phone Number</Label>
                      <Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField>
                      <Label>Company Name</Label>
                      <Input value={profileCompany} onChange={(e) => setProfileCompany(e.target.value)} />
                    </FormField>
                    <FormField>
                      <Label>Customer Group</Label>
                      <Select
                        value={profileGroup}
                        onChange={(e) => setProfileGroup(e.target.value)}
                        options={groups.map((g) => ({ value: g.id, label: g.name }))}
                      />
                    </FormField>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button type="submit" variant="primary" size="md">
                      Save Profile Changes
                    </Button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title="Saved Addresses"
                icon="map-pin"
                action={
                  <CardAction onClick={handleOpenAddAddress}>
                    <Icon name="plus" size={12} /> Add Address
                  </CardAction>
                }
                bodyClassName="p-0"
              >
                {addresses.length === 0 ? (
                  <CardEmpty icon="map-pin" title="No addresses on file" hint="Add a shipping or billing address for this customer." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Street</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Postal Code</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addresses.map((addr) => (
                        <TableRow key={addr.id}>
                          <TableCell className="font-semibold text-m-text">
                            {addr.streetNumber} {addr.streetName}
                          </TableCell>
                          <TableCell>{addr.city}</TableCell>
                          <TableCell>{addr.state}</TableCell>
                          <TableCell className="font-mono text-xs">{addr.postalCode}</TableCell>
                          <TableCell>{addr.country}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {addr.isDefaultShipping && <StatusPill tone="primary" dot={false}>Default Ship</StatusPill>}
                              {addr.isDefaultBilling && <StatusPill tone="neutral" dot={false}>Default Bill</StatusPill>}
                              {!addr.isDefaultShipping && addr.isShipping && <StatusPill tone="neutral" dot={false}>Shipping</StatusPill>}
                              {!addr.isDefaultBilling && addr.isBilling && <StatusPill tone="neutral" dot={false}>Billing</StatusPill>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenEditAddress(addr)}>
                                Edit
                              </Button>
                              {!addr.isDefaultShipping && (
                                <Button variant="ghost" size="sm" onClick={() => handleSetDefaultShipping(addr.id)}>
                                  Set Def Ship
                                </Button>
                              )}
                              {!addr.isDefaultBilling && (
                                <Button variant="ghost" size="sm" onClick={() => handleSetDefaultBilling(addr.id)}>
                                  Set Def Bill
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmAddrId(addr.id)}>
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </SectionCard>
            </MainColumn>

            <SideColumn>
              <QuickActions>
                <QuickAction
                  icon="plus-circle"
                  label="Create Ticket"
                  onClick={() => router.push(`/tickets/create?customerId=${customer?.id || id}&email=${customer?.email}`)}
                />
                <QuickAction icon="message-square" label="Send Message" onClick={() => setActiveTab("conversations")} />
                <QuickAction
                  icon="key-round"
                  label="Send Password Reset"
                  onClick={() => {
                    setActiveTab("notes");
                    handleSendPasswordReset();
                  }}
                  disabled={passwordResetStatus === "sending"}
                />
              </QuickActions>

              <SectionCard title="Customer Identifiers" icon="id-card">
                <InfoList>
                  <InfoRow label="Customer Number" value={customer?.customerNumber} mono />
                  <InfoRow label="External ID" value={customer?.externalId} mono />
                  <InfoRow label="Company" value={customer?.companyName} />
                  <InfoRow label="Customer Group" value={customer?.customerGroup?.name} />
                  <InfoRow
                    label="Default Shipping"
                    value={
                      defaultShippingAddress
                        ? `${defaultShippingAddress.city || ""}${defaultShippingAddress.city && defaultShippingAddress.country ? ", " : ""}${defaultShippingAddress.country || ""}`.trim()
                        : undefined
                    }
                  />
                  <InfoRow
                    label="Default Billing"
                    value={
                      defaultBillingAddress
                        ? `${defaultBillingAddress.city || ""}${defaultBillingAddress.city && defaultBillingAddress.country ? ", " : ""}${defaultBillingAddress.country || ""}`.trim()
                        : undefined
                    }
                  />
                </InfoList>
              </SectionCard>
            </SideColumn>
          </ContentGrid>
        </>
      )}

      {/* ── Orders ───────────────────────────────────────────────────────── */}
      {activeTab === "orders" && (
        <ContentGrid>
          <MainColumn>
            <SectionCard
              title="Recent Orders"
              icon="shopping-bag"
              action={totalOrderCount > 0 ? <span className="text-[12px] text-m-text-muted">{totalOrderCount} total</span> : undefined}
              bodyClassName="p-0"
            >
              <div className="border-b border-m-border/70 p-3">
                <SearchBar
                  value={ordersSearch}
                  onChange={(val) => setOrdersSearch(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value)}
                  onClear={() => setOrdersSearch("")}
                  placeholder="Filter orders by number, status, total..."
                />
              </div>
              {ordersLoading ? (
                <p className="py-6 text-center text-xs text-m-text-muted">Loading orders from commerce platform…</p>
              ) : filteredOrders.length === 0 ? (
                <CardEmpty icon="shopping-bag" title="No orders found" hint="This customer has not placed any orders yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((row) => (
                      <TableRow key={row.id} clickable onClick={() => router.push(`/orders/${row.orderNumber}`)}>
                        <TableCell className="font-bold text-m-primary">
                          <Link href={`/orders/${row.orderNumber}`}>{row.orderNumber}</Link>
                        </TableCell>
                        <TableCell className="font-semibold">{row.totalPrice}</TableCell>
                        <TableCell>{row.itemsCount}</TableCell>
                        <TableCell>
                          <StatusPill tone={orderStateTone(row.orderState)}>{row.orderState}</StatusPill>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={paymentStateTone(row.paymentState)}>{row.paymentState}</StatusPill>
                        </TableCell>
                        <TableCell>{row.createdAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>

            <SectionCard title="Quotes" icon="file-text">
              {quotes.length === 0 ? (
                <CardEmpty icon="file-text" title="No quotes on file" hint="Customer-level quotes aren't wired to a backend yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote ID</TableHead>
                      <TableHead>Quote Key</TableHead>
                      <TableHead>Total Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-bold text-m-primary">{q.id}</TableCell>
                        <TableCell className="font-mono text-xs">{q.quoteKey}</TableCell>
                        <TableCell className="font-semibold">{q.totalPrice}</TableCell>
                        <TableCell>
                          <StatusPill tone="success">{q.quoteState}</StatusPill>
                        </TableCell>
                        <TableCell>{q.validUntil}</TableCell>
                        <TableCell>{q.createdAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </MainColumn>

          <SideColumn>
            <SectionCard
              title="Active & Saved Carts"
              icon="shopping-cart"
              action={
                <CardAction onClick={() => setShowOrderBehalfPanel((prev) => !prev)}>
                  <Icon name="plus" size={12} /> New Cart
                </CardAction>
              }
              bodyClassName="p-0"
            >
              {showOrderBehalfPanel && (
                <div className="space-y-3 border-b border-m-border/70 p-3.5">
                  <p className="text-[12px] font-semibold text-m-text">Create cart for customer</p>
                  <div className="grid grid-cols-1 gap-3">
                    <FormField>
                      <Label>Country</Label>
                      <Select value={cartCountry} onChange={(e) => setCartCountry(e.target.value)} options={COUNTRY_OPTIONS} />
                    </FormField>
                    <FormField>
                      <Label>Currency</Label>
                      <Select value={cartCurrency} onChange={(e) => setCartCurrency(e.target.value)} options={CURRENCY_OPTIONS} />
                    </FormField>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowOrderBehalfPanel(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleCreateCart}>
                      Create Cart
                    </Button>
                  </div>
                </div>
              )}
              {carts.length === 0 ? (
                <CardEmpty icon="shopping-cart" title="No active carts" />
              ) : (
                <ul className="divide-y divide-m-border/70">
                  {carts.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/cart/${row.id}`}
                        className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[12.5px] hover:bg-m-surface-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-m-primary">{row.id}</div>
                          <div className="text-[11.5px] text-m-text-muted">{row.lineItemsCount} items</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-semibold text-m-text">{row.totalPrice}</span>
                          <StatusPill tone="warning">{row.cartState}</StatusPill>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </SideColumn>
        </ContentGrid>
      )}

      {/* ── Returns ──────────────────────────────────────────────────────── */}
      {activeTab === "returns" && (
        <SectionCard title="Return History" icon="rotate-ccw" bodyClassName="p-0">
          <div className="border-b border-m-border/70 p-3">
            <SearchBar
              value={returnsSearch}
              onChange={(val) => setReturnsSearch(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value)}
              onClear={() => setReturnsSearch("")}
              placeholder="Filter returns by Order No, Tracking ID..."
            />
          </div>
          {filteredReturns.length === 0 ? (
            <CardEmpty icon="rotate-ccw" title="No returns found" hint="No return activity is recorded for this customer's orders." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Return Tracking ID</TableHead>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Items Count</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map((row) => (
                  <TableRow key={row.id} clickable onClick={() => setSelectedReturn(row)}>
                    <TableCell className="font-bold text-m-primary">{row.orderNumber}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{row.returnTrackingId}</TableCell>
                    <TableCell>{row.returnDate}</TableCell>
                    <TableCell>{row.itemsCount}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedReturn(row)}>
                        View Items Breakdown
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Return Details Modal */}
          {selectedReturn && (
            <Modal isOpen={Boolean(selectedReturn)} onClose={() => setSelectedReturn(null)}>
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between border-b border-m-border pb-3">
                  <h3 className="text-base font-bold text-m-text">
                    Return Details: {selectedReturn.returnTrackingId}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReturn(null)}>
                    ✕
                  </Button>
                </div>

                <InfoList columns={2}>
                  <InfoRow label="Order Number" value={selectedReturn.orderNumber} />
                  <InfoRow label="Return Date" value={selectedReturn.returnDate} />
                  <InfoRow label="Items" value={selectedReturn.itemsCount} />
                </InfoList>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-m-text">Line Items Breakdown</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Qty</TableHead>
                        <TableHead>Shipment State</TableHead>
                        <TableHead>Payment State</TableHead>
                        <TableHead>Comment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-bold">{item.quantity}</TableCell>
                          <TableCell>
                            <StatusPill tone="warning">{item.shipmentState}</StatusPill>
                          </TableCell>
                          <TableCell>
                            <StatusPill tone="success">{item.paymentState}</StatusPill>
                          </TableCell>
                          <TableCell className="text-xs text-m-text-muted">{item.comment || "--"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Modal>
          )}
        </SectionCard>
      )}

      {/* ── Payments ─────────────────────────────────────────────────────── */}
      {activeTab === "payments" && (
        <SectionCard title="Payments" icon="credit-card">
          {payments.length === 0 ? (
            <CardEmpty icon="credit-card" title="No payments on file" hint="Customer-level payment history isn't wired to a backend yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold text-m-primary">{p.id}</TableCell>
                    <TableCell className="font-medium text-m-text">{p.method}</TableCell>
                    <TableCell className="font-semibold">{p.amount}</TableCell>
                    <TableCell>
                      <StatusPill tone={paymentStateTone(p.status)}>{p.status}</StatusPill>
                    </TableCell>
                    <TableCell>{p.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      )}

      {/* ── Conversations ────────────────────────────────────────────────── */}
      {activeTab === "conversations" && (
        <ContentGrid>
          <MainColumn>
            <SectionCard
              title="Support Tickets"
              icon="life-buoy"
              action={
                <CardAction
                  onClick={() => router.push(`/tickets/create?customerId=${customer?.id || id}&email=${customer?.email}`)}
                >
                  <Icon name="plus" size={12} /> Create Ticket
                </CardAction>
              }
              bodyClassName="p-0"
            >
              <div className="border-b border-m-border/70 p-3">
                <SearchBar
                  value={ticketsSearch}
                  onChange={(val) => setTicketsSearch(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value)}
                  onClear={() => setTicketsSearch("")}
                  placeholder="Search tickets by number, subject..."
                />
              </div>
              {ticketsLoading ? (
                <p className="py-6 text-center text-xs text-m-text-muted">Loading tickets for this customer…</p>
              ) : filteredTickets.length === 0 ? (
                <CardEmpty
                  icon="life-buoy"
                  title="No tickets found"
                  hint={customer?.email ? "No tickets found for this customer." : "Customer email required to load tickets."}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket Number</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((t) => (
                      <TableRow key={t.id} clickable onClick={() => router.push(`/tickets/${t.id}`)}>
                        <TableCell className="font-bold text-m-primary">{t.ticketNumber}</TableCell>
                        <TableCell className="font-medium text-m-text">{t.subject}</TableCell>
                        <TableCell>
                          <StatusPill tone={ticketStatusTone(t.status)}>{t.status}</StatusPill>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={ticketPriorityTone(t.priority)}>{t.priority}</StatusPill>
                        </TableCell>
                        <TableCell>{t.createdAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>

            <SectionCard title="Messages" icon="message-square">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <CardEmpty icon="message-square" title="No messages yet" hint="Send a reply below to start the conversation record." />
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`space-y-1.5 rounded-m-lg border p-3.5 text-xs ${
                        m.sender === "customer" ? "border-m-border bg-m-surface-2" : "border-m-primary-200 bg-m-primary-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-m-text">{m.senderName}</span>
                          {m.orderNumber && <StatusPill tone="neutral" dot={false}>{m.orderNumber}</StatusPill>}
                        </div>
                        <span className="text-[11px] text-m-text-muted">{m.createdAt}</span>
                      </div>
                      <p className="leading-relaxed text-m-text">{m.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendMessage} className="mt-4 space-y-3 border-t border-m-border/70 pt-4">
                <Label>Send Message / Reply</Label>
                <textarea
                  className="w-full rounded-m-md border border-m-border bg-transparent p-3 text-xs text-m-text focus:outline-none focus:ring-1 focus:ring-m-primary"
                  rows={3}
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type a support reply to send to customer..."
                />
                <div className="flex justify-end">
                  <Button variant="primary" size="sm" type="submit">
                    Send Message
                  </Button>
                </div>
              </form>
            </SectionCard>
          </MainColumn>

          <SideColumn>
            <QuickActions>
              <QuickAction
                icon="plus-circle"
                label="Create Ticket"
                onClick={() => router.push(`/tickets/create?customerId=${customer?.id || id}&email=${customer?.email}`)}
              />
              <QuickAction
                icon="mail"
                label="Email Customer"
                onClick={() => alert(`Opening email client for ${customer?.email}`)}
              />
            </QuickActions>
          </SideColumn>
        </ContentGrid>
      )}

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {activeTab === "notes" && (
        <ContentGrid>
          <MainColumn>
            <SectionCard title="Password Reset" icon="lock">
              <div className="max-w-xl space-y-4">
                <p className="text-xs leading-relaxed text-m-text">
                  Send a secure password reset link to customer email:{" "}
                  <strong>{customer?.email || "—"}</strong>
                </p>
                <p className="text-xs text-m-text-muted">
                  The customer will receive an automated email containing a single-use secure link to generate a new password.
                </p>

                {passwordResetStatus === "sent" && (
                  <div className="rounded-m-md bg-m-success-light px-3 py-2 text-[12.5px] font-semibold text-m-success">
                    Password reset link sent successfully!
                  </div>
                )}

                <Button
                  variant="primary"
                  size="md"
                  loading={passwordResetStatus === "sending"}
                  disabled={passwordResetStatus === "sent"}
                  onClick={handleSendPasswordReset}
                >
                  {passwordResetStatus === "sent" ? "Reset Link Sent" : "Send Password Reset Link"}
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Promotions & Coupons" icon="tag">
              <div className="space-y-3">
                <div className="flex max-w-md items-center gap-3">
                  <Input
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    placeholder="Enter coupon code (e.g. SUMMER15)..."
                  />
                  <Button variant="primary" size="md" onClick={handleValidateCoupon}>
                    Validate & Apply
                  </Button>
                </div>

                {couponFeedback && (
                  <p
                    className={`text-xs font-semibold ${
                      couponFeedback.type === "success"
                        ? "text-m-success"
                        : couponFeedback.type === "error"
                        ? "text-m-error"
                        : "text-m-primary"
                    }`}
                  >
                    {couponFeedback.msg}
                  </p>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-m-text-muted">Assigned Promotions</h4>
                {assignedPromotions.length === 0 ? (
                  <CardEmpty icon="tag" title="No promotions assigned" hint="Validate a coupon code above to assign a promotion." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Promotion</TableHead>
                        <TableHead>Coupon / Key</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Coupon Required</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignedPromotions.map((promo) => (
                        <TableRow key={promo.id}>
                          <TableCell className="font-semibold text-m-text">{promo.name}</TableCell>
                          <TableCell className="font-mono text-xs">{promo.key}</TableCell>
                          <TableCell className="font-bold text-m-primary">{promo.discount}</TableCell>
                          <TableCell>{promo.requiresDiscountCode ? "Yes" : "No"}</TableCell>
                          <TableCell>{promo.validUntil}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAssignedPromotions((prev) => prev.filter((p) => p.id !== promo.id))}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-m-text-muted">Promotion Usage History</h4>
                {promotionUsages.length === 0 ? (
                  <CardEmpty icon="history" title="No promotion usage recorded" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Coupon Code</TableHead>
                        <TableHead>Promotion Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Used On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promotionUsages.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-bold text-m-primary">{u.orderNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{u.couponCode}</TableCell>
                          <TableCell>{u.promotionName}</TableCell>
                          <TableCell>
                            <StatusPill tone="success">{u.state}</StatusPill>
                          </TableCell>
                          <TableCell>{u.usedAt}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </SectionCard>
          </MainColumn>

          <SideColumn>
            <SectionCard title="Account Notes" icon="file-text">
              <CardEmpty
                icon="file-text"
                title="No internal notes yet"
                hint="Free-form rep notes aren't wired to a backend yet — nothing fabricated here."
              />
            </SectionCard>
          </SideColumn>
        </ContentGrid>
      )}

      {/* Add / Edit Address Modal */}
      {showAddressModal && (
        <Modal isOpen={showAddressModal} onClose={() => setShowAddressModal(false)}>
          <form onSubmit={handleSaveAddress} className="space-y-4 p-6">
            <h3 className="text-base font-bold text-m-text">
              {editingAddrId ? "Edit Address" : "Add New Address"}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <Label>Street Name</Label>
                <Input value={addrStreetName} onChange={(e) => setAddrStreetName(e.target.value)} />
              </FormField>
              <FormField>
                <Label>Street Number</Label>
                <Input value={addrStreetNumber} onChange={(e) => setAddrStreetNumber(e.target.value)} />
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField>
                <Label>City</Label>
                <Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
              </FormField>
              <FormField>
                <Label>State</Label>
                <Input value={addrState} onChange={(e) => setAddrState(e.target.value)} />
              </FormField>
              <FormField>
                <Label>Postal Code</Label>
                <Input value={addrPostalCode} onChange={(e) => setAddrPostalCode(e.target.value)} />
              </FormField>
            </div>

            <FormField>
              <Label>Country</Label>
              <Select value={addrCountry} onChange={(e) => setAddrCountry(e.target.value)} options={COUNTRY_OPTIONS} />
            </FormField>

            <div className="flex flex-col gap-2 border-t border-m-border pt-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-m-text">
                <input
                  type="checkbox"
                  checked={addrIsDefaultShip}
                  onChange={(e) => setAddrIsDefaultShip(e.target.checked)}
                />
                Use as Default Shipping Address
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-m-text">
                <input
                  type="checkbox"
                  checked={addrIsDefaultBill}
                  onChange={(e) => setAddrIsDefaultBill(e.target.checked)}
                />
                Use as Default Billing Address
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowAddressModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Save Address
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmAddrId && (
        <Modal isOpen={Boolean(deleteConfirmAddrId)} onClose={() => setDeleteConfirmAddrId(null)}>
          <div className="max-w-md space-y-4 p-6">
            <h3 className="text-base font-bold text-m-text">Delete Address</h3>
            <p className="text-xs text-m-text-muted">
              Are you sure you want to delete this address from the customer&apos;s record?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmAddrId(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDeleteAddress(deleteConfirmAddrId)}>
                Delete Address
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DetailPage>
  );
}
