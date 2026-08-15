"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "@apollo/client";
import { CUSTOMER_ORDERS_QUERY, CUSTOMER_CARTS_QUERY, CUSTOMER_ADDRESSES_QUERY } from "../orders/api/queries";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardMetric,
  Badge,
  Button,
  Avatar,
  Icon,
  Tabs,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Select,
  SearchBar,
  Panel,
  Modal,
  FormField,
  Label,
} from "@csa/ui";
import { useCustomerStore } from "../customers/hooks/use-customers";
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
} from "../customers/types/customer-types";

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

export function CustomerDetailView({ id }: CustomerDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "summary";

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
          createdAt: t.createdAt ? new Date(t.createdAt).toLocaleString() : "--",
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
        createdAt: o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-US") : "--",
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
          returnDate: ri.returnDate ? new Date(ri.returnDate).toLocaleDateString("en-US") : "--",
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      createdAt: new Date().toLocaleString(),
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
    : "Mia Johnson";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to Customer Directory
        </Link>

        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Avatar name={customerFullName} size="lg" status="online" />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-m-text">{customerFullName}</span>
                <span className="text-xs text-m-text-muted">
                  ID: {customer?.id || id} • {customer?.companyName || "Northwind Retail"}
                </span>
              </div>
            </div>
          }
          subtitle={`Customer No: ${customer?.customerNumber || "CN-90412"} • Primary Email: ${customer?.email || "mia.johnson@example.com"}`}
          badge={
            <Badge variant="primary" appearance="solid" size="md">
              {customer?.customerGroup?.name || "VIP Gold Tier"}
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Icon name="mail" size="xs" />}
                onClick={() => alert(`Opening email client for ${customer?.email}`)}
              >
                Email Customer
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Icon name="plus" size="xs" />}
                onClick={() =>
                  router.push(`/tickets/create?customerId=${customer?.id || id}&email=${customer?.email}`)
                }
              >
                Create Ticket
              </Button>
            </div>
          }
        />
      </div>

      {(loading || error) && (
        <Panel
          className={`p-3 rounded-lg border text-xs font-semibold ${
            error
              ? "border-m-danger/30 bg-m-danger-surface text-m-danger"
              : "border-m-border bg-m-bg-surface text-m-text-muted"
          }`}
        >
          {error
            ? "Unable to load this customer from the BFF. Showing available local customer state."
            : "Loading customer data from the BFF..."}
        </Panel>
      )}

      {/* Overview Metric Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <CardMetric
          title="Total Orders"
          value={ordersLoading ? "…" : totalOrderCount.toString()}
          subtitle="Lifetime customer orders"
        />
        <CardMetric
          title="Total Spend"
          value={ordersLoading ? "…" : totalSpend}
          subtitle={totalOrderCount > 100 ? `From first 100 of ${totalOrderCount} orders` : "Across all fetched orders"}
        />
        <CardMetric
          title="Support Tickets"
          value={ticketsLoading ? "…" : tickets.length.toString()}
          subtitle={tickets.length > 0 ? `${tickets.filter((t) => t.priority === "High" || t.priority === "Urgent").length} high/urgent` : "No open tickets"}
        />
        <CardMetric title="Saved Carts" value={totalCartsCount.toString()} subtitle="Active checkout carts" />
      </section>

      {/* Customer 360 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline">
        <Tabs.List className="overflow-x-auto">
          <Tabs.Trigger value="summary" icon={<Icon name="user" size="xs" />}>Summary</Tabs.Trigger>
          <Tabs.Trigger value="profile" icon={<Icon name="edit" size="xs" />}>Profile</Tabs.Trigger>
          <Tabs.Trigger value="carts" icon={<Icon name="shopping-cart" size="xs" />}>Carts ({totalCartsCount})</Tabs.Trigger>
          <Tabs.Trigger value="orders" icon={<Icon name="shopping-bag" size="xs" />}>Orders ({totalOrderCount})</Tabs.Trigger>
          <Tabs.Trigger value="returns" icon={<Icon name="rotate-ccw" size="xs" />}>Returns ({returns.length})</Tabs.Trigger>
          <Tabs.Trigger value="quotes" icon={<Icon name="file-text" size="xs" />}>Quotes ({quotes.length})</Tabs.Trigger>
          <Tabs.Trigger value="payments" icon={<Icon name="credit-card" size="xs" />}>Payments ({payments.length})</Tabs.Trigger>
          <Tabs.Trigger value="addresses" icon={<Icon name="map-pin" size="xs" />}>Addresses ({addresses.length})</Tabs.Trigger>
          <Tabs.Trigger value="tickets" icon={<Icon name="life-buoy" size="xs" />}>Tickets ({tickets.length})</Tabs.Trigger>
          <Tabs.Trigger value="messages" icon={<Icon name="message-square" size="xs" />}>Messages ({messages.length})</Tabs.Trigger>
          <Tabs.Trigger value="password" icon={<Icon name="lock" size="xs" />}>Password</Tabs.Trigger>
          <Tabs.Trigger value="promotions" icon={<Icon name="tag" size="xs" />}>Promotions ({assignedPromotions.length})</Tabs.Trigger>
        </Tabs.List>

        {/* 1. Summary Tab */}
        <Tabs.Content value="summary" className="space-y-6">
          <Panel className="p-4 bg-m-bg-surface rounded-lg border border-m-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-m-text-muted mb-3">Customer Identifiers</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-m-text-muted block">Full Name</span>
                <span className="text-sm font-bold text-m-text">{customerFullName}</span>
              </div>
              <div>
                <span className="text-xs text-m-text-muted block">Customer Number</span>
                <span className="text-sm font-mono font-bold text-m-primary">{customer?.customerNumber || "CN-90412"}</span>
              </div>
              <div>
                <span className="text-xs text-m-text-muted block">External ID</span>
                <span className="text-sm font-mono text-m-text-muted">{customer?.externalId || "EXT-88219"}</span>
              </div>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Default Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs leading-relaxed">
                {defaultShippingAddress ? (
                  <>
                    <p className="font-semibold text-m-text">{customerFullName}</p>
                    <p className="text-m-text-muted">
                      {defaultShippingAddress.streetNumber} {defaultShippingAddress.streetName}
                    </p>
                    <p className="text-m-text-muted">
                      {defaultShippingAddress.city}, {defaultShippingAddress.state} {defaultShippingAddress.postalCode}
                    </p>
                    <p className="text-m-text-muted">{defaultShippingAddress.country}</p>
                  </>
                ) : (
                  <p className="text-m-text-muted italic">No shipping address recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Default Billing Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs leading-relaxed">
                {defaultBillingAddress ? (
                  <>
                    <p className="font-semibold text-m-text">{customerFullName}</p>
                    <p className="text-m-text-muted">
                      {defaultBillingAddress.streetNumber} {defaultBillingAddress.streetName}
                    </p>
                    <p className="text-m-text-muted">
                      {defaultBillingAddress.city}, {defaultBillingAddress.state} {defaultBillingAddress.postalCode}
                    </p>
                    <p className="text-m-text-muted">{defaultBillingAddress.country}</p>
                  </>
                ) : (
                  <p className="text-m-text-muted italic">No billing address recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </Tabs.Content>

        {/* 2. Profile Tab */}
        <Tabs.Content value="profile">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Customer General Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
                {profileSavedMsg && (
                  <div className="p-3 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                    {profileSavedMsg}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField>
                    <Label required>First Name</Label>
                    <Input value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)} />
                  </FormField>

                  <FormField>
                    <Label required>Last Name</Label>
                    <Input value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField>
                    <Label required>Email</Label>
                    <Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
                  </FormField>

                  <FormField>
                    <Label>Phone Number</Label>
                    <Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" size="md">
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* 3. Carts Tab */}
        <Tabs.Content value="carts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-m-text">Active & Saved Carts</h3>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() => setShowOrderBehalfPanel((prev) => !prev)}
            >
              Order on behalf of customer
            </Button>
          </div>

          {showOrderBehalfPanel && (
            <Panel className="p-4 bg-m-bg-surface space-y-3 rounded-lg border border-m-border">
              <h4 className="text-xs font-bold text-m-text">Create Cart for Customer</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                <FormField>
                  <Label>Country</Label>
                  <Select
                    value={cartCountry}
                    onChange={(e) => setCartCountry(e.target.value)}
                    options={COUNTRY_OPTIONS}
                  />
                </FormField>
                <FormField>
                  <Label>Currency</Label>
                  <Select
                    value={cartCurrency}
                    onChange={(e) => setCartCurrency(e.target.value)}
                    options={CURRENCY_OPTIONS}
                  />
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
            </Panel>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cart ID</TableHead>
                <TableHead>Order Number</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carts.map((row) => (
                <TableRow key={row.id} clickable onClick={() => router.push(`/cart/${row.id}`)}>
                  <TableCell className="font-bold text-m-primary">
                    <Link href={`/cart/${row.id}`}>{row.id}</Link>
                  </TableCell>
                  <TableCell>{row.orderNumber}</TableCell>
                  <TableCell className="font-semibold">{row.totalPrice}</TableCell>
                  <TableCell>{row.lineItemsCount}</TableCell>
                  <TableCell>
                    <Badge variant="warning" size="sm" dot>
                      {row.cartState}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tabs.Content>

        {/* 4. Orders Tab */}
        <Tabs.Content value="orders" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-sm">
              <SearchBar
                value={ordersSearch}
                onChange={(val) => setOrdersSearch(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value)}
                onClear={() => setOrdersSearch("")}
                placeholder="Filter orders by number, status, total..."
              />
            </div>
            {totalOrderCount > 0 && (
              <span className="text-xs text-m-text-muted whitespace-nowrap ml-4">
                {totalOrderCount} total orders
              </span>
            )}
          </div>

          {ordersLoading ? (
            <p className="text-xs text-m-text-muted py-6 text-center">Loading orders from commerce platform…</p>
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
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-m-text-muted py-6">
                      No orders found for this customer.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((row) => (
                    <TableRow key={row.id} clickable onClick={() => router.push(`/orders/${row.orderNumber}`)}>
                      <TableCell className="font-bold text-m-primary">
                        <Link href={`/orders/${row.orderNumber}`}>{row.orderNumber}</Link>
                      </TableCell>
                      <TableCell className="font-semibold">{row.totalPrice}</TableCell>
                      <TableCell>{row.itemsCount}</TableCell>
                      <TableCell>
                        <Badge variant="success" size="sm" dot>
                          {row.orderState}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="primary" size="sm">
                          {row.paymentState}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.createdAt}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Tabs.Content>

        {/* 5. Returns Tab */}
        <Tabs.Content value="returns" className="space-y-4">
          <div className="w-full max-w-sm">
            <SearchBar
              value={returnsSearch}
              onChange={(val) => setReturnsSearch(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value)}
              onClear={() => setReturnsSearch("")}
              placeholder="Filter returns by Order No, Tracking ID..."
            />
          </div>

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

          {/* Return Details Modal */}
          {selectedReturn && (
            <Modal isOpen={Boolean(selectedReturn)} onClose={() => setSelectedReturn(null)}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-m-border pb-3">
                  <h3 className="text-base font-bold text-m-text">
                    Return Details: {selectedReturn.returnTrackingId}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReturn(null)}>
                    ✕
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-m-text-muted block">Order Number</span>
                    <span className="font-bold text-m-primary">{selectedReturn.orderNumber}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">Return Date</span>
                    <span className="font-semibold text-m-text">{selectedReturn.returnDate}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">Items</span>
                    <span className="font-semibold text-m-text">{selectedReturn.itemsCount}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-m-text uppercase tracking-wider">Line Items Breakdown</h4>
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
                            <Badge variant="warning" size="sm">{item.shipmentState}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="success" size="sm">{item.paymentState}</Badge>
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
        </Tabs.Content>

        {/* 6. Quotes Tab */}
        <Tabs.Content value="quotes">
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
                    <Badge variant="success" size="sm">{q.quoteState}</Badge>
                  </TableCell>
                  <TableCell>{q.validUntil}</TableCell>
                  <TableCell>{q.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tabs.Content>

        {/* 7. Payments Tab */}
        <Tabs.Content value="payments">
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
                    <Badge variant="success" size="sm">{p.status}</Badge>
                  </TableCell>
                  <TableCell>{p.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tabs.Content>

        {/* 8. Addresses Tab */}
        <Tabs.Content value="addresses" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-m-text">Customer Addresses</h3>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={handleOpenAddAddress}
            >
              Add Address
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Street</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Postal Code</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Badges / Type</TableHead>
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
                      {addr.isDefaultShipping && <Badge variant="primary" size="sm">Default Ship</Badge>}
                      {addr.isDefaultBilling && <Badge variant="neutral" size="sm">Default Bill</Badge>}
                      {!addr.isDefaultShipping && addr.isShipping && <Badge variant="neutral" size="sm">Shipping</Badge>}
                      {!addr.isDefaultBilling && addr.isBilling && <Badge variant="neutral" size="sm">Billing</Badge>}
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

          {/* Add / Edit Address Modal */}
          {showAddressModal && (
            <Modal isOpen={showAddressModal} onClose={() => setShowAddressModal(false)}>
              <form onSubmit={handleSaveAddress} className="p-6 space-y-4">
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
                  <Select
                    value={addrCountry}
                    onChange={(e) => setAddrCountry(e.target.value)}
                    options={COUNTRY_OPTIONS}
                  />
                </FormField>

                <div className="flex flex-col gap-2 pt-2 border-t border-m-border">
                  <label className="flex items-center gap-2 text-xs font-semibold text-m-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addrIsDefaultShip}
                      onChange={(e) => setAddrIsDefaultShip(e.target.checked)}
                    />
                    Use as Default Shipping Address
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-m-text cursor-pointer">
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
              <div className="p-6 space-y-4 max-w-md">
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
        </Tabs.Content>

        {/* 9. Tickets Tab */}
        <Tabs.Content value="tickets" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-sm">
              <SearchBar
                value={ticketsSearch}
                onChange={(val) => setTicketsSearch(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value)}
                onClear={() => setTicketsSearch("")}
                placeholder="Search tickets by number, subject..."
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() =>
                router.push(`/tickets/create?customerId=${customer?.id || id}&email=${customer?.email}`)
              }
            >
              Create Ticket
            </Button>
          </div>

          {ticketsLoading ? (
            <p className="text-xs text-m-text-muted py-6 text-center">Loading tickets for this customer…</p>
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
                {filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-m-text-muted py-6">
                      {customer?.email ? "No tickets found for this customer." : "Customer email required to load tickets."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((t) => (
                    <TableRow key={t.id} clickable onClick={() => router.push(`/tickets/${t.id}`)}>
                      <TableCell className="font-bold text-m-primary">{t.ticketNumber}</TableCell>
                      <TableCell className="font-medium text-m-text">{t.subject}</TableCell>
                      <TableCell>
                        <Badge variant="warning" size="sm">{t.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="error" size="sm">{t.priority}</Badge>
                      </TableCell>
                      <TableCell>{t.createdAt}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Tabs.Content>

        {/* 10. Messages Tab */}
        <Tabs.Content value="messages" className="space-y-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Customer Communication Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 rounded-lg border text-xs space-y-1.5 ${
                      m.sender === "customer"
                        ? "bg-m-bg-surface border-m-border"
                        : "bg-m-primary-surface border-m-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-m-text">{m.senderName}</span>
                        {m.orderNumber && (
                          <Badge variant="neutral" size="sm">
                            {m.orderNumber}
                          </Badge>
                        )}
                      </div>
                      <span className="text-m-text-muted text-[11px]">{m.createdAt}</span>
                    </div>
                    <p className="text-m-text leading-relaxed">{m.content}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="space-y-3 pt-4 border-t border-m-border">
                <Label>Send Message / Reply</Label>
                <textarea
                  className="w-full p-3 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
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
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* 11. Password Tab */}
        <Tabs.Content value="password">
          <Card variant="default" className="max-w-xl">
            <CardHeader>
              <CardTitle>Password Reset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-m-text leading-relaxed">
                Send a secure password reset link to customer email:{" "}
                <strong>{customer?.email || "mia.johnson@example.com"}</strong>
              </p>
              <p className="text-xs text-m-text-muted">
                The customer will receive an automated email containing a single-use secure link to generate a new password.
              </p>

              {passwordResetStatus === "sent" && (
                <div className="p-3 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
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
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* 12. Promotions Tab */}
        <Tabs.Content value="promotions" className="space-y-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Coupon Code Application & Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 max-w-md">
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
                      ? "text-m-danger"
                      : "text-m-primary"
                  }`}
                >
                  {couponFeedback.msg}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Assigned Promotions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-m-text uppercase tracking-wider">Assigned Promotions</h4>
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
                        onClick={() =>
                          setAssignedPromotions((prev) => prev.filter((p) => p.id !== promo.id))
                        }
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Promotion Usage History */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-m-text uppercase tracking-wider">Promotion Usage History</h4>
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
                      <Badge variant="success" size="sm">{u.state}</Badge>
                    </TableCell>
                    <TableCell>{u.usedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
