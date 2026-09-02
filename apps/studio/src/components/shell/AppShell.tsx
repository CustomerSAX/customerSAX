"use client";

import { gql, useQuery } from "@apollo/client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
  TopBar,
  Avatar,
  Dropdown,
  Icon
} from "@csa/ui";
import { useCurrentUser, roleLabel, type CurrentUser } from "@/lib/use-current-user";
import { apolloClient } from "@/graphql/client";

const sidebarGroups: SidebarGroup[] = [
  {
    id: "operations",
    title: "Operations",
    items: [
      { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" },
      { id: "tickets", href: "/tickets", label: "Tickets", icon: "ticket-check" },
      { id: "customers", href: "/customers", label: "Customers", icon: "users" }
    ]
  },
  {
    id: "commerce",
    title: "Commerce",
    items: [
      { id: "orders", href: "/orders", label: "Orders", icon: "shopping-bag" },
      { id: "cart", href: "/cart", label: "Cart", icon: "shopping-cart" },
      { id: "products", href: "/products", label: "Products", icon: "package" }
    ]
  },
  {
    id: "intelligence",
    title: "Intelligence",
    items: [
      { id: "reports", href: "/reports", label: "Reports", icon: "bar-chart-3" },
      { id: "knowledgebase", href: "/knowledgebase", label: "Knowledge Base", icon: "book-open" },
      { id: "csa-assistant", href: "/csa-assistant", label: "CSA Assistant", icon: "sparkles" }
    ]
  },
  {
    id: "administration",
    title: "Administration",
    items: [{ id: "audit-log", href: "/admin/audit-log", label: "Audit Log", icon: "lock" }]
  }
];

const b2bSidebarGroups: SidebarGroup[] = [
  {
    id: "operations",
    title: "Operations",
    items: [
      { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" },
      { id: "tickets", href: "/tickets", label: "Tickets", icon: "ticket-check" }
    ]
  },
  {
    id: "business-unit",
    title: "Business Unit",
    items: [
      { id: "b2b-company", href: "/b2b/company", label: "Companies", icon: "building-2" },
      { id: "b2b-employees", href: "/b2b/employees", label: "Employees", icon: "users" },
      { id: "b2b-import-export", href: "/b2b/import-export", label: "Import / Export", icon: "upload" }
    ]
  },
  {
    id: "commerce",
    title: "Commerce",
    items: [
      { id: "orders", href: "/orders", label: "Orders", icon: "shopping-bag" },
      { id: "cart", href: "/cart", label: "Cart", icon: "shopping-cart" },
      { id: "b2b-quotes", href: "/b2b/quotes", label: "Quotes", icon: "file-text" },
      { id: "products", href: "/products", label: "Products", icon: "package" }
    ]
  },
  {
    id: "intelligence",
    title: "Intelligence",
    items: [{ id: "csa-assistant", href: "/csa-assistant", label: "CSA Assistant", icon: "sparkles" }]
  },
  {
    id: "administration",
    title: "Administration",
    items: [{ id: "audit-log", href: "/admin/audit-log", label: "Audit Log", icon: "lock" }]
  }
];

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: string;
  shortcut?: string;
  keywords?: string[];
};

type GlobalSearchResult = {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: string;
  type: string;
};

type PaletteItem = (CommandItem | GlobalSearchResult) & { paletteSection: "navigate" | "create" | "results" };

type MoneyResult = {
  centAmount?: number | null;
  currencyCode?: string | null;
  fractionDigits?: number | null;
};

type OrderSearchRow = {
  id?: string | null;
  orderNumber?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  state?: string | null;
  orderState?: string | null;
  totalPrice?: MoneyResult | null;
};

type QuoteSearchRow = {
  id?: string | null;
  key?: string | null;
  quoteNumber?: string | null;
  companyKey?: string | null;
  companyName?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  status?: string | null;
  totalPrice?: MoneyResult | null;
};

type TicketSearchRow = {
  id?: string | null;
  ticketNumber?: string | null;
  customerEmail?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  orderNumber?: string | null;
};

type ProductSearchRow = {
  id?: string | null;
  sku?: string | null;
  name?: string | null;
  description?: string | null;
};

type CustomerSearchRow = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type CartSearchRow = {
  id?: string | null;
  key?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  cartState?: string | null;
  totalPrice?: MoneyResult | null;
};

type ShellPermission = {
  module: string;
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

type ShellRole = {
  key: string;
  permissions: ShellPermission[];
};

type ShellRolesData = {
  adminRoles: ShellRole[];
};

const SHELL_ROLES_QUERY = gql`
  query ShellRoles($clientId: ID!, $projectKey: String!) {
    adminRoles(clientId: $clientId, projectKey: $projectKey) {
      key
      permissions {
        module
        view
        create
        update
        delete
      }
    }
  }
`;

const ORDERS_GLOBAL_SEARCH_QUERY = gql`
  query GlobalSearchOrders($limit: Int!, $offset: Int!) {
    orderPage(limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
      results {
        id
        orderNumber
        customerEmail
        customerId
        state
        orderState
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`;

const QUOTES_GLOBAL_SEARCH_QUERY = gql`
  query GlobalSearchQuotes($limit: Int!, $offset: Int!) {
    quotes(limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
      results {
        id
        key
        quoteNumber
        companyKey
        companyName
        customerEmail
        customerId
        status
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`;

const standardNavigateCommands: CommandItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", shortcut: "G D" },
  { id: "tickets", label: "Tickets", href: "/tickets", icon: "ticket-check", shortcut: "G T" },
  { id: "customers", label: "Customers", href: "/customers", icon: "users", shortcut: "G C" },
  { id: "orders", label: "Orders", href: "/orders", icon: "shopping-bag", shortcut: "G O" },
  { id: "cart", label: "Cart", href: "/cart", icon: "shopping-cart", shortcut: "G A" },
  { id: "products", label: "Products", href: "/products", icon: "package", shortcut: "G P" },
  { id: "reports", label: "Reports", href: "/reports", icon: "bar-chart-3", shortcut: "G R" },
  { id: "knowledgebase", label: "Knowledge Base", href: "/knowledgebase", icon: "book-open" },
  { id: "assistant", label: "CSA Assistant", href: "/csa-assistant", icon: "sparkles" }
];

const b2bNavigateCommands: CommandItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", shortcut: "G D" },
  { id: "companies", label: "Companies", href: "/b2b/company", icon: "building-2", shortcut: "G C", keywords: ["company", "business unit"] },
  { id: "employees", label: "Employees", href: "/b2b/employees", icon: "users", shortcut: "G E", keywords: ["employee", "users"] },
  { id: "tickets", label: "Tickets", href: "/tickets", icon: "ticket-check", shortcut: "G T" },
  { id: "orders", label: "Orders", href: "/orders", icon: "shopping-bag", shortcut: "G O" },
  { id: "quotes", label: "Quotes", href: "/b2b/quotes", icon: "file-text", shortcut: "G Q" },
  { id: "cart", label: "Cart", href: "/cart", icon: "shopping-cart", shortcut: "G A" },
  { id: "products", label: "Products", href: "/products", icon: "package", shortcut: "G P" },
  { id: "import-export", label: "Import / Export", href: "/b2b/import-export", icon: "upload" },
  { id: "assistant", label: "CSA Assistant", href: "/csa-assistant", icon: "sparkles" }
];

const standardCreateCommands: CommandItem[] = [
  { id: "create-customer", label: "Create Customer", description: "New customer profile", href: "/customers/create", icon: "user-plus" },
  { id: "create-ticket", label: "Create Ticket", description: "New support ticket", href: "/tickets/create", icon: "ticket-plus" }
];

const b2bCreateCommands: CommandItem[] = [
  { id: "create-company", label: "Create Company", description: "New business unit", href: "/b2b/company/create", icon: "building-2" },
  { id: "add-employee", label: "Add Employee", description: "New B2B employee", href: "/b2b/employees/create", icon: "user-plus" },
  { id: "create-quote", label: "Create Quote", description: "New quote request", href: "/b2b/quotes/create", icon: "file-text" }
];

const navigationModuleById: Record<string, string | string[] | undefined> = {
  dashboard: "dashboard",
  tickets: "tickets",
  customers: "customers",
  orders: "orders",
  cart: "carts",
  products: "products",
  reports: "reports",
  knowledgebase: "knowledgebase",
  "csa-assistant": "assistant",
  "audit-log": "audit",
  "admin-settings": ["users", "roles", "email"],
};

const commandPermissionById: Record<string, { module: string; action: keyof ShellPermission } | undefined> = {
  dashboard: { module: "dashboard", action: "view" },
  tickets: { module: "tickets", action: "view" },
  customers: { module: "customers", action: "view" },
  orders: { module: "orders", action: "view" },
  cart: { module: "carts", action: "view" },
  products: { module: "products", action: "view" },
  reports: { module: "reports", action: "view" },
  knowledgebase: { module: "knowledgebase", action: "view" },
  assistant: { module: "assistant", action: "view" },
  "create-customer": { module: "customers", action: "create" },
  "create-ticket": { module: "tickets", action: "create" },
};

function commandMatches(item: CommandItem, query: string) {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  const haystack = [item.label, item.description, item.href, ...(item.keywords ?? [])].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(needle);
}

function textMatches(query: string, values: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return values.some((value) => (value ?? "").toLowerCase().includes(needle));
}

function formatMoney(money?: MoneyResult | null) {
  if (!money || money.centAmount == null) return "";
  const fractionDigits = money.fractionDigits ?? 2;
  const amount = money.centAmount / 10 ** fractionDigits;
  return `${money.currencyCode ?? "USD"} ${amount.toFixed(fractionDigits)}`;
}

function uniqResults(results: GlobalSearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.type}:${result.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// FAIL-CLOSED: when /api/auth/me hasn't resolved (or failed), we must NOT render
// the console as an administrator. This fallback is a NON-privileged identity —
// role "agent", no projects — so a failed/absent session never exposes admin-only
// navigation (Admin Settings, Superadmin). The real authenticated user, when it
// loads, replaces this entirely; the middleware still gates page access by cookie.
const fallbackUser: CurrentUser = {
  email: "",
  id: "unauthenticated",
  name: "CSA Agent",
  role: "agent",
  tenantId: "",
  projects: [],
  requiresProjectSelection: false
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const currentUser = user ?? fallbackUser;
  const canUseRolePermissions = currentUser.role === "admin" && Boolean(currentUser.activeClientId && currentUser.activeProjectKey);
  const { data: shellRolesData } = useQuery<ShellRolesData>(SHELL_ROLES_QUERY, {
    variables: { clientId: currentUser.activeClientId ?? "", projectKey: currentUser.activeProjectKey ?? "" },
    skip: !canUseRolePermissions,
    fetchPolicy: "cache-and-network",
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [entityResults, setEntityResults] = useState<GlobalSearchResult[]>([]);
  const [isEntitySearchLoading, setIsEntitySearchLoading] = useState(false);
  const commandSearchRef = useRef<HTMLInputElement>(null);

  const userDisplayName = currentUser.name || currentUser.email;
  const userSubtitle = useMemo(() => roleLabel(currentUser.role), [currentUser.role]);

  const isB2bMode = useMemo(() => {
    const activeProject = currentUser.projects.find(
      (project) =>
        project.projectKey === currentUser.activeProjectKey &&
        (project.clientId ?? "") === (currentUser.activeClientId ?? "")
    );
    const activeShellMode = currentUser.activeProjectShellMode ?? activeProject?.shellMode;
    const activeProjectKey = currentUser.activeProjectKey ?? currentUser.projectKey ?? activeProject?.projectKey ?? "";

    return (
      activeShellMode === "b2b" ||
      activeProjectKey.toLowerCase().includes("b2b") ||
      process.env.NEXT_PUBLIC_PROJECT_TYPE === "B2B" ||
      process.env.NEXT_PUBLIC_CT_BUSINESS_TYPE === "B2B" ||
      pathname?.startsWith("/b2b")
    );
  }, [
    currentUser.activeClientId,
    currentUser.activeProjectKey,
    currentUser.activeProjectShellMode,
    currentUser.projectKey,
    currentUser.projects,
    pathname
  ]);

  const activeRolePermissions = useMemo(() => {
    if (currentUser.role === "superadmin") return null;
    return shellRolesData?.adminRoles.find((role) => role.key === currentUser.role)?.permissions;
  }, [currentUser.role, shellRolesData?.adminRoles]);

  const permissionByModule = useMemo(() => {
    if (!activeRolePermissions) return null;
    return new Map(activeRolePermissions.map((permission) => [permission.module, permission]));
  }, [activeRolePermissions]);

  const canViewNavigationItem = useCallback((item: SidebarItem) => {
    if (currentUser.role === "superadmin" || !permissionByModule) return true;
    const modules = navigationModuleById[item.id];
    if (!modules) return true;
    const moduleList = Array.isArray(modules) ? modules : [modules];
    return moduleList.some((module) => permissionByModule.get(module)?.view);
  }, [currentUser.role, permissionByModule]);

  const canUseCommand = useCallback((item: CommandItem) => {
    if (currentUser.role === "superadmin" || !permissionByModule) return true;
    const permission = commandPermissionById[item.id];
    if (!permission) return true;
    return Boolean(permissionByModule.get(permission.module)?.[permission.action]);
  }, [currentUser.role, permissionByModule]);

  const groups = useMemo(() => {
    let baseGroups = isB2bMode ? [...b2bSidebarGroups] : [...sidebarGroups];
    baseGroups = baseGroups.map((group) =>
      group.id === "administration"
        ? {
            ...group,
            items: [
              ...((currentUser.role === "admin" || currentUser.role === "superadmin")
                ? [{ id: "admin-settings", href: "/admin/users", label: "Admin Settings", icon: "settings" } as SidebarItem]
                : []),
              ...group.items,
              ...(currentUser.role === "superadmin"
                ? [{ id: "superadmin", href: "/superadmin", label: "Superadmin", icon: "shield-check" } as SidebarItem]
                : [])
            ]
          }
        : group
    );
    return baseGroups
      .map((group) => ({ ...group, items: group.items.filter(canViewNavigationItem) }))
      .filter((group) => group.items.length > 0);
  }, [canViewNavigationItem, currentUser.role, isB2bMode]);

  const navigateCommands = useMemo(
    () => (isB2bMode ? b2bNavigateCommands : standardNavigateCommands).filter(canUseCommand),
    [canUseCommand, isB2bMode]
  );

  const createCommands = useMemo(
    () => (isB2bMode ? b2bCreateCommands : standardCreateCommands).filter(canUseCommand),
    [canUseCommand, isB2bMode]
  );

  const visibleNavigateCommands = useMemo(
    () => navigateCommands.filter((item) => commandMatches(item, globalSearch)),
    [globalSearch, navigateCommands]
  );

  const visibleCreateCommands = useMemo(
    () => createCommands.filter((item) => commandMatches(item, globalSearch)),
    [createCommands, globalSearch]
  );

  const visibleCommands = useMemo(
    () =>
      [
        ...visibleNavigateCommands.map((item) => ({ ...item, paletteSection: "navigate" as const })),
        ...entityResults.map((item) => ({ ...item, paletteSection: "results" as const })),
        ...visibleCreateCommands.map((item) => ({ ...item, paletteSection: "create" as const })),
      ] satisfies PaletteItem[],
    [entityResults, visibleCreateCommands, visibleNavigateCommands]
  );

  const openCommand = useCallback(
    (item: CommandItem | GlobalSearchResult) => {
      setIsSearchOpen(false);
      setGlobalSearch("");
      setActiveCommandIndex(0);
      router.push(item.href);
    },
    [router]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    setActiveCommandIndex(0);
    window.requestAnimationFrame(() => commandSearchRef.current?.focus());
  }, [isSearchOpen]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [globalSearch]);

  useEffect(() => {
    const query = globalSearch.trim();
    if (!isSearchOpen || query.length < 2) {
      setEntityResults([]);
      setIsEntitySearchLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadResults = async () => {
      setIsEntitySearchLoading(true);
      const lowerQuery = query.toLowerCase();

      const [
        ticketsResult,
        productsResult,
        customersResult,
        cartsResult,
        ordersResult,
        quotesResult,
      ] = await Promise.allSettled([
        fetch(`/api/tickets?limit=100`, { cache: "no-store", signal: controller.signal }),
        fetch(`/api/product-search?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal }),
        fetch(`/api/customers/search?query=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal }),
        fetch(`/api/carts?limit=100`, { cache: "no-store", signal: controller.signal }),
        apolloClient.query<{ orderPage?: { results?: OrderSearchRow[] } }>({
          query: ORDERS_GLOBAL_SEARCH_QUERY,
          variables: { limit: 100, offset: 0 },
          fetchPolicy: "network-only",
        }),
        apolloClient.query<{ quotes?: { results?: QuoteSearchRow[] } }>({
          query: QUOTES_GLOBAL_SEARCH_QUERY,
          variables: { limit: 100, offset: 0 },
          fetchPolicy: "network-only",
        }),
      ]);

      if (cancelled) return;

      const nextResults: GlobalSearchResult[] = [];

      if (ticketsResult.status === "fulfilled" && ticketsResult.value.ok) {
        const ticketJson = (await ticketsResult.value.json().catch(() => ({}))) as { results?: TicketSearchRow[] };
        for (const ticket of ticketJson.results ?? []) {
          if (
            !ticket.id ||
            !textMatches(lowerQuery, [ticket.ticketNumber, ticket.customerEmail, ticket.subject, ticket.orderNumber, ticket.status, ticket.priority])
          ) {
            continue;
          }
          nextResults.push({
            id: `ticket-${ticket.id}`,
            type: "Ticket",
            label: ticket.ticketNumber || ticket.subject || ticket.id,
            description: [ticket.subject, ticket.customerEmail, ticket.status].filter(Boolean).join(" · "),
            href: `/tickets/${ticket.id}`,
            icon: "ticket-check",
          });
        }
      }

      if (ordersResult.status === "fulfilled") {
        const orders = ordersResult.value.data.orderPage?.results ?? [];
        for (const order of orders) {
          const identifier = order.orderNumber || order.id;
          if (
            !identifier ||
            !textMatches(lowerQuery, [order.orderNumber, order.id, order.customerEmail, order.customerId, order.state, order.orderState])
          ) {
            continue;
          }
          nextResults.push({
            id: `order-${identifier}`,
            type: "Order",
            label: identifier,
            description: [order.customerEmail || order.customerId, order.state || order.orderState, formatMoney(order.totalPrice)]
              .filter(Boolean)
              .join(" · "),
            href: `/orders/${identifier}`,
            icon: "shopping-bag",
          });
        }
      }

      if (productsResult.status === "fulfilled" && productsResult.value.ok) {
        const productJson = (await productsResult.value.json().catch(() => ({}))) as { results?: ProductSearchRow[] };
        for (const product of productJson.results ?? []) {
          if (!product.id) continue;
          nextResults.push({
            id: `product-${product.id}`,
            type: "Product",
            label: product.name || product.sku || product.id,
            description: [product.sku, product.description].filter(Boolean).join(" · "),
            href: `/products/${product.id}`,
            icon: "package",
          });
        }
      }

      if (customersResult.status === "fulfilled" && customersResult.value.ok) {
        const customerJson = (await customersResult.value.json().catch(() => ({}))) as { results?: CustomerSearchRow[] };
        for (const customer of customerJson.results ?? []) {
          if (!customer.id) continue;
          nextResults.push({
            id: `customer-${customer.id}`,
            type: isB2bMode ? "Employee" : "Customer",
            label: customer.name || customer.email || customer.id,
            description: customer.email || customer.id,
            href: isB2bMode ? `/b2b/employees/${customer.id}` : `/customers/${customer.id}`,
            icon: isB2bMode ? "users" : "user",
          });
        }
      }

      if (cartsResult.status === "fulfilled" && cartsResult.value.ok) {
        const cartJson = (await cartsResult.value.json().catch(() => ({}))) as { results?: CartSearchRow[] };
        for (const cart of cartJson.results ?? []) {
          if (!cart.id || !textMatches(lowerQuery, [cart.id, cart.key, cart.customerEmail, cart.customerId, cart.cartState])) {
            continue;
          }
          nextResults.push({
            id: `cart-${cart.id}`,
            type: "Cart",
            label: cart.key || cart.id,
            description: [cart.customerEmail || cart.customerId, cart.cartState, formatMoney(cart.totalPrice)].filter(Boolean).join(" · "),
            href: `/cart/${cart.id}`,
            icon: "shopping-cart",
          });
        }
      }

      if (quotesResult.status === "fulfilled") {
        const quotes = quotesResult.value.data.quotes?.results ?? [];
        for (const quote of quotes) {
          const identifier = quote.id || quote.quoteNumber || quote.key;
          if (
            !identifier ||
            !textMatches(lowerQuery, [
              quote.id,
              quote.quoteNumber,
              quote.key,
              quote.companyKey,
              quote.companyName,
              quote.customerEmail,
              quote.customerId,
              quote.status,
            ])
          ) {
            continue;
          }
          nextResults.push({
            id: `quote-${identifier}`,
            type: "Quote",
            label: quote.quoteNumber || quote.key || quote.id || identifier,
            description: [quote.companyName || quote.companyKey, quote.customerEmail, quote.status, formatMoney(quote.totalPrice)]
              .filter(Boolean)
              .join(" · "),
            href: `/b2b/quotes/${identifier}`,
            icon: "file-text",
          });
        }
      }

      if (!cancelled) {
        setEntityResults(uniqResults(nextResults).slice(0, 12));
        setIsEntitySearchLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void loadResults(), 250);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [globalSearch, isB2bMode, isSearchOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  const handleProjectChange = async (selection: string) => {
    const project = currentUser.projects.find(
      (candidate) => `${candidate.clientId ?? ""}:${candidate.projectKey}` === selection
    );
    if (!project) return;

    const response = await fetch("/api/auth/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectKey: project.projectKey, clientId: project.clientId })
    });
    if (!response.ok) return;

    await apolloClient.clearStore();
    window.location.assign(pathname || "/dashboard");
  };

  const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";

  // The projects list can legitimately contain exact duplicates (the same
  // clientId:projectKey returned twice) and distinct projects that happen to
  // share a display name. De-dupe the former by identity, and disambiguate the
  // latter in the option label so the rep can tell them apart — without ever
  // altering the real display names themselves.
  const uniqueProjects = useMemo(() => {
    const seen = new Set<string>();
    return currentUser.projects.filter((project) => {
      const key = `${project.clientId ?? ""}:${project.projectKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [currentUser.projects]);

  const projectOptionLabel = (project: CurrentUser["projects"][number]) => {
    const base = project.displayName || project.projectKey;
    const collides =
      uniqueProjects.filter((candidate) => (candidate.displayName || candidate.projectKey) === base).length > 1;
    if (!collides) return base;
    // Same display name across different projects → append the projectKey (and
    // clientId when even that matches) so each option is uniquely identifiable.
    const keyCollides =
      uniqueProjects.filter(
        (candidate) => (candidate.displayName || candidate.projectKey) === base && candidate.projectKey === project.projectKey
      ).length > 1;
    return keyCollides ? `${base} · ${project.projectKey} · ${project.clientId ?? "—"}` : `${base} · ${project.projectKey}`;
  };

  // Find active item ID
  let activeItemId = "dashboard";
  for (const group of groups) {
    for (const item of group.items) {
      if (
        item.href &&
        (pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)) ||
          (item.href === "/dashboard" && pathname === "/"))
      ) {
        activeItemId = item.id;
      }
    }
  }

  const handleSelectItem = (item: SidebarItem) => {
    if (item.href) {
      router.push(item.href);
    }
  };

  const sidebarBrand = (
    <div className="flex items-center gap-2.5">
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--csa-yellow-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--csa-navy-950)', lineHeight: 1 }}>C</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--csa-white)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          customerSAX
        </span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--sidebar-text)',
            marginTop: 1,
          }}
        >
          Studio
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-ink)' }}
    >
      {/* ── CSA Sidebar ──────────────────────────── */}
      <Sidebar
        brand={sidebarBrand}
        groups={groups}
        activeItemId={activeItemId}
        onSelectItem={handleSelectItem}
        footer={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--text-xs)',
              color: 'var(--sidebar-text)',
            }}
          >
            <Icon name="shield-check" size="xs" style={{ color: 'var(--csa-yellow-500)', flexShrink: 0 }} />
            <span>Enterprise v1.0</span>
          </div>
        }
      />

      {/* ── Main area ────────────────────────────── */}
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{ background: 'var(--color-bg)' }}
      >
        {/* ── Yellow TopBar ─────────────────────── */}
        <TopBar
          brandOrBreadcrumbs={
            <div className="flex items-center gap-3">
              {isB2bMode && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(5,8,46,0.12)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--topbar-text)',
                  }}
                >
                  <Icon name="building-2" size="xs" />
                  B2B Mode
                </span>
              )}
              {currentUser.projects.length > 0 && (
                <select
                  aria-label="Project"
                  value={currentUser.activeProjectKey ? `${currentUser.activeClientId ?? ""}:${currentUser.activeProjectKey}` : ""}
                  onChange={(event) => void handleProjectChange(event.target.value)}
                  style={{
                    height: 34,
                    minWidth: 170,
                    maxWidth: 240,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--topbar-overlay)',
                    background: 'rgba(255,255,255,0.25)',
                    padding: '0 12px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--topbar-text)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {uniqueProjects.map((project) => (
                    <option
                      key={`${project.clientId ?? "legacy"}:${project.projectKey}`}
                      value={`${project.clientId ?? ""}:${project.projectKey}`}
                    >
                      {projectOptionLabel(project)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          }
          searchSlot={
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsSearchOpen(true);
                }
              }}
              className="flex items-center gap-2"
              style={{
                background: 'var(--topbar-search-bg)',
                border: '1px solid var(--topbar-search-border)',
                borderRadius: 'var(--radius-full)',
                padding: '0 16px',
                height: 40,
                width: '100%',
                maxWidth: 480,
                margin: '0 auto',
              }}
            >
              <Icon name="search" size="sm" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="search"
                placeholder={isB2bMode ? "Search companies, employees, orders, quotes..." : "Search customers, orders, tickets..."}
                aria-label="Global search"
                readOnly
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink)',
                  minWidth: 0,
                  cursor: 'pointer',
                }}
              />
              <kbd
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  background: 'var(--color-surface-3)',
                  flexShrink: 0,
                }}
              >
                ⌘K
              </kbd>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              {/* Features removed until workflows are built */}
            </div>
          }
          userSlot={
            <Dropdown
              trigger={
                <div
                  className="flex items-center gap-2 cursor-pointer select-none"
                  style={{ padding: '4px 8px 4px 4px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.18)' }}
                >
                  <Avatar name={userDisplayName} status="online" size="sm" />
                  <div className="hidden flex-col sm:flex">
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--topbar-text)',
                        lineHeight: 1.1,
                      }}
                    >
                      {userDisplayName}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--topbar-text-muted)',
                        marginTop: 1,
                      }}
                    >
                      {userSubtitle}
                    </span>
                  </div>
                  <Icon name="chevron-down" size="xs" style={{ color: 'var(--topbar-text-muted)' }} />
                </div>
              }
              items={[
                { id: "profile", label: "My Profile", icon: "user", onClick: () => router.push("/profile") },
                ...(isAdmin
                  ? [{ id: "settings", label: "Org Settings", icon: "settings", onClick: () => router.push("/admin/users") }]
                  : []),
                "divider",
                { id: "logout", label: "Sign out", icon: "log-out", danger: true, onClick: handleLogout }
              ]}
            />
          }
        />

        {isSearchOpen && (
          <div
            className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/40 px-4 pt-20 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            onMouseDown={() => setIsSearchOpen(false)}
          >
            <div
              className="w-full max-w-3xl overflow-hidden rounded-m-2xl border border-m-border bg-m-surface shadow-m-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-m-border px-5 py-4">
                <Icon name="search" size="md" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <input
                  ref={commandSearchRef}
                  type="search"
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setIsSearchOpen(false);
                      return;
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveCommandIndex((index) =>
                        visibleCommands.length === 0 ? 0 : (index + 1) % visibleCommands.length
                      );
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveCommandIndex((index) =>
                        visibleCommands.length === 0 ? 0 : (index - 1 + visibleCommands.length) % visibleCommands.length
                      );
                      return;
                    }
                    if (event.key === "Enter" && visibleCommands[activeCommandIndex]) {
                      event.preventDefault();
                      openCommand(visibleCommands[activeCommandIndex]);
                    }
                  }}
                  placeholder={
                    isB2bMode
                      ? "Search companies, employees, orders, quotes, and more..."
                      : "Search customers, orders, tickets, and more..."
                  }
                  aria-label="Search commands"
                  className="min-w-0 flex-1 bg-transparent text-base text-m-text outline-none placeholder:text-m-text-muted"
                />
                <kbd className="rounded-m-md border border-m-border bg-m-surface-2 px-2 py-1 text-xs text-m-text-muted">
                  ⌘ K
                </kbd>
              </div>

              <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
                {visibleCommands.length === 0 ? (
                  <div className="rounded-m-lg border border-m-border bg-m-surface-2 px-4 py-5 text-sm text-m-text-muted">
                    No matching results.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {visibleNavigateCommands.length > 0 && (
                      <section>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-m-text-muted">
                          <Icon name="arrow-right" size="xs" />
                          Navigate
                        </div>
                        <div className="space-y-1">
                          {visibleNavigateCommands.map((item, index) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openCommand(item)}
                              className={`flex w-full items-center gap-3 rounded-m-lg px-3 py-2.5 text-left transition ${
                                activeCommandIndex === index ? "bg-m-surface-2" : "hover:bg-m-surface-2"
                              }`}
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-m-md bg-m-surface-2 text-m-text-muted">
                                <Icon name={item.icon} size="sm" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-m-text">{item.label}</span>
                                {item.description && (
                                  <span className="block truncate text-xs text-m-text-muted">{item.description}</span>
                                )}
                              </span>
                              {item.shortcut && (
                                <span className="text-xs font-medium tracking-[0.18em] text-m-text-muted">{item.shortcut}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {(entityResults.length > 0 || isEntitySearchLoading) && (
                      <section>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-m-text-muted">
                          <Icon name="search" size="xs" />
                          Results
                        </div>
                        {isEntitySearchLoading && entityResults.length === 0 ? (
                          <div className="rounded-m-lg border border-m-border bg-m-surface-2 px-4 py-3 text-sm text-m-text-muted">
                            Searching...
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {entityResults.map((item, index) => {
                              const commandIndex = visibleNavigateCommands.length + index;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => openCommand(item)}
                                  className={`flex w-full items-center gap-3 rounded-m-lg px-3 py-2.5 text-left transition ${
                                    activeCommandIndex === commandIndex ? "bg-m-surface-2" : "hover:bg-m-surface-2"
                                  }`}
                                >
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-m-md bg-m-surface-2 text-m-text-muted">
                                    <Icon name={item.icon} size="sm" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-m-text">{item.label}</span>
                                    {item.description && (
                                      <span className="block truncate text-xs text-m-text-muted">{item.description}</span>
                                    )}
                                  </span>
                                  <span className="rounded-m-full bg-m-surface-2 px-2 py-1 text-xs font-semibold text-m-text-muted">
                                    {item.type}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    )}

                    {visibleCreateCommands.length > 0 && (
                      <section>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-m-text-muted">
                          <Icon name="plus-circle" size="xs" />
                          Create
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {visibleCreateCommands.map((item, index) => {
                            const commandIndex = visibleNavigateCommands.length + entityResults.length + index;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => openCommand(item)}
                                className={`flex items-center gap-3 rounded-m-lg border border-m-border px-3 py-3 text-left transition ${
                                  activeCommandIndex === commandIndex ? "bg-m-surface-2" : "hover:bg-m-surface-2"
                                }`}
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-m-lg bg-m-surface-2 text-m-primary">
                                  <Icon name={item.icon} size="sm" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-m-text">{item.label}</span>
                                  {item.description && (
                                    <span className="block truncate text-xs text-m-text-muted">{item.description}</span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-m-border bg-m-surface-2 px-5 py-3 text-xs text-m-text-muted">
                <span><kbd className="rounded border border-m-border bg-m-surface px-1.5 py-0.5">↑↓</kbd> navigate</span>
                <span><kbd className="rounded border border-m-border bg-m-surface px-1.5 py-0.5">↵</kbd> open</span>
                <span><kbd className="rounded border border-m-border bg-m-surface px-1.5 py-0.5">esc</kbd> close</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Page content ─────────────────────── */}
        <main
          className={`flex-1 flex flex-col ${
            pathname === '/csa-assistant' ? 'overflow-hidden' : 'overflow-auto'
          }`}
          style={{
            padding: pathname === '/csa-assistant' ? 0 : '28px 32px',
            background: 'var(--color-bg)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
