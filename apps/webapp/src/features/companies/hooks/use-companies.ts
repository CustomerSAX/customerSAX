"use client";

import { useQuery } from "@apollo/client";
import { useState, useCallback, useMemo } from "react";
import type { Company, CompanyAddress, CompanyAssociate, CompanyFilter, CompanySort } from "../types/company-types";
import { COMPANIES_QUERY, COMPANY_ACTIVITY_QUERY } from "../api/queries";
import { INITIAL_COMPANIES } from "../constants/mock-companies";

type MoneyResult = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

type CompanyResult = {
  id: string;
  key: string;
  name: string;
  status?: string | null;
  unitType?: string | null;
  contactEmail?: string | null;
  associateMode?: string | null;
  storeMode?: string | null;
  approvalRuleMode?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
  parentUnit?: {
    id?: string | null;
    key?: string | null;
    name?: string | null;
  } | null;
  addresses: Array<{
    id?: string | null;
    key?: string | null;
    streetName?: string | null;
    streetNumber?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    company?: string | null;
  }>;
  associates: Array<{
    id?: string | null;
    customerId?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    roles: string[];
  }>;
};

type CompaniesData = {
  companies: {
    results: CompanyResult[];
  };
};

type CompanyActivityData = {
  companyCarts: {
    results: Array<{
      id: string;
      key?: string | null;
      customerId?: string | null;
      currencyCode: string;
      totalPrice: MoneyResult;
      lineItems: Array<{ id: string; quantity: number }>;
    }>;
  };
  companyOrders: {
    results: Array<{
      id: string;
      orderNumber?: string | null;
      customerId?: string | null;
      customerEmail?: string | null;
      orderState?: string | null;
      paymentState?: string | null;
      createdAt?: string | null;
      totalPrice?: MoneyResult | null;
    }>;
  };
  quotes: {
    results: Array<{
      id: string;
      key?: string | null;
      quoteNumber?: string | null;
      companyKey?: string | null;
      companyName?: string | null;
      customerId?: string | null;
      customerEmail?: string | null;
      status?: string | null;
      createdAt?: string | null;
      lastModifiedAt?: string | null;
      totalPrice?: MoneyResult | null;
    }>;
  };
};

const moneyToNumber = (money?: MoneyResult | null) => {
  if (!money) return 0;
  return money.centAmount / 10 ** money.fractionDigits;
};

const mapCompany = (company: CompanyResult): Company => ({
  id: company.id,
  key: company.key,
  name: company.name,
  status: company.status === "Inactive" ? "Inactive" : "Active",
  unitType: company.unitType === "Division" ? "Division" : "Company",
  parentId: company.parentUnit?.id ?? undefined,
  parentName: company.parentUnit?.name ?? company.parentUnit?.key ?? undefined,
  createdAt: company.createdAt ?? "",
  lastModifiedAt: company.lastModifiedAt ?? company.createdAt ?? "",
  addresses: company.addresses.map((address, index) => ({
    id: address.id ?? address.key ?? `${company.id}-address-${index}`,
    companyName: address.company ?? company.name,
    streetName: address.streetName ?? "",
    streetNumber: address.streetNumber ?? undefined,
    city: address.city ?? "",
    state: address.state ?? undefined,
    postalCode: address.postalCode ?? "",
    country: address.country ?? "",
  })),
  associates: company.associates.map((associate, index) => {
    const name = [associate.firstName, associate.lastName].filter(Boolean).join(" ").trim();
    return {
      id: associate.id ?? associate.customerId ?? `${company.id}-associate-${index}`,
      customerId: associate.customerId ?? associate.id ?? "",
      name: name || associate.email || "Company associate",
      email: associate.email ?? "",
      roles: associate.roles.length > 0 ? associate.roles : ["Buyer"],
      status: "Active",
    };
  }),
});

export function useCompanies() {
  const { data, error, loading: queryLoading } = useQuery<CompaniesData>(COMPANIES_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: {
      limit: 100,
      offset: 0,
      searchField: undefined,
      searchText: undefined,
      sortKey: "createdAt",
      sortOrder: "desc",
    },
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyOverrides, setCompanyOverrides] = useState<Record<string, Partial<Company>>>({});
  const [filter, setFilter] = useState<CompanyFilter>({ searchField: "all", searchText: "" });
  const [sort, setSort] = useState<CompanySort>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const serverCompanies = useMemo(() => {
    return (data?.companies.results ?? []).map(mapCompany);
  }, [data?.companies.results]);

  const allCompanies = useMemo(() => {
    const applyOverrides = (company: Company) => ({
      ...company,
      ...(companyOverrides[company.id] ?? companyOverrides[company.key] ?? {}),
    });

    if (serverCompanies.length > 0) return [...companies.map(applyOverrides), ...serverCompanies.map(applyOverrides)];
    const fallbackCompanies = companies.length > 0 ? companies : INITIAL_COMPANIES;
    return fallbackCompanies.map(applyOverrides);
  }, [companies, companyOverrides, serverCompanies]);

  const loading = queryLoading && !error && serverCompanies.length === 0;

  const filteredCompanies = useMemo(() => {
    let result = [...allCompanies];

    if (filter.searchText.trim()) {
      const q = filter.searchText.toLowerCase().trim();
      result = result.filter((comp) => {
        if (filter.searchField === "name") return comp.name.toLowerCase().includes(q);
        if (filter.searchField === "key") return comp.key.toLowerCase().includes(q);
        return (
          comp.name.toLowerCase().includes(q) ||
          comp.key.toLowerCase().includes(q) ||
          (comp.parentName && comp.parentName.toLowerCase().includes(q))
        );
      });
    }

    if (filter.statusFilter) {
      result = result.filter((comp) => comp.status === filter.statusFilter);
    }

    if (filter.unitTypeFilter) {
      result = result.filter((comp) => comp.unitType === filter.unitTypeFilter);
    }

    result.sort((a, b) => {
      const valA = a[sort.key] ?? "";
      const valB = b[sort.key] ?? "";
      if (valA < valB) return sort.order === "asc" ? -1 : 1;
      if (valA > valB) return sort.order === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [allCompanies, filter, sort]);

  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredCompanies.slice(start, start + perPage);
  }, [filteredCompanies, page, perPage]);

  const getCompanyById = useCallback(
    (id: string) => allCompanies.find((c) => c.id === id || c.key === id),
    [allCompanies]
  );

  const createCompany = useCallback((newCompany: Omit<Company, "id" | "createdAt" | "lastModifiedAt">) => {
    const created: Company = {
      ...newCompany,
      id: `bu-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    };
    setCompanies((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateCompany = useCallback((id: string, updates: Partial<Company>) => {
    setCompanyOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        ...updates,
        lastModifiedAt: new Date().toISOString(),
      },
    }));
    setCompanies((prev) =>
      prev.map((comp) =>
        comp.id === id || comp.key === id
          ? { ...comp, ...updates, lastModifiedAt: new Date().toISOString() }
          : comp
      )
    );
  }, []);

  const addCompanyAddress = useCallback((companyId: string, address: Omit<CompanyAddress, "id">) => {
    const newAddress: CompanyAddress = {
      ...address,
      id: `addr-${Date.now()}`,
    };
    const existing = getCompanyById(companyId);
    if (existing) {
      setCompanyOverrides((prev) => ({
        ...prev,
        [companyId]: {
          ...(prev[companyId] ?? {}),
          addresses: [...existing.addresses, newAddress],
          lastModifiedAt: new Date().toISOString(),
        },
      }));
    }
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === companyId
          ? {
              ...c,
              addresses: [...c.addresses, newAddress],
              lastModifiedAt: new Date().toISOString(),
            }
          : c
      )
    );
  }, [getCompanyById]);

  const addCompanyAssociate = useCallback((companyId: string, associate: Omit<CompanyAssociate, "id">) => {
    const newAssoc: CompanyAssociate = {
      ...associate,
      id: `assoc-${Date.now()}`,
    };
    const existing = getCompanyById(companyId);
    if (existing) {
      setCompanyOverrides((prev) => ({
        ...prev,
        [companyId]: {
          ...(prev[companyId] ?? {}),
          associates: [...existing.associates, newAssoc],
          lastModifiedAt: new Date().toISOString(),
        },
      }));
    }
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === companyId
          ? {
              ...c,
              associates: [...c.associates, newAssoc],
              lastModifiedAt: new Date().toISOString(),
            }
          : c
      )
    );
  }, [getCompanyById]);

  return {
    companies: paginatedCompanies,
    allCompanies,
    totalItems: filteredCompanies.length,
    loading,
    filter,
    sort,
    page,
    perPage,
    setFilter,
    setSort,
    setPage,
    setPerPage,
    getCompanyById,
    createCompany,
    updateCompany,
    addCompanyAddress,
    addCompanyAssociate,
  };
}

export function useCompanyCommerceActivity(companyKey?: string) {
  const { data, loading, error } = useQuery<CompanyActivityData>(COMPANY_ACTIVITY_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: !companyKey,
    variables: {
      companyKey,
      limit: 20,
      offset: 0,
    },
  });

  const carts = useMemo(() => {
    return (data?.companyCarts.results ?? []).map((cart) => ({
      id: cart.key ?? cart.id,
      customerEmail: cart.customerId ?? "--",
      itemCount: cart.lineItems.reduce((total, item) => total + item.quantity, 0),
      totalPrice: moneyToNumber(cart.totalPrice),
      cartState: "Active",
      createdAt: "",
    }));
  }, [data?.companyCarts.results]);

  const orders = useMemo(() => {
    return (data?.companyOrders.results ?? []).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber ?? order.id,
      customerEmail: order.customerEmail ?? order.customerId ?? "--",
      orderState: order.orderState ?? "Open",
      paymentState: order.paymentState ?? "Pending",
      totalPrice: moneyToNumber(order.totalPrice),
      createdAt: order.createdAt ?? "",
    }));
  }, [data?.companyOrders.results]);

  const quotes = useMemo(() => {
    return (data?.quotes.results ?? []).map((quote) => ({
      id: quote.id,
      quoteNumber: quote.quoteNumber ?? quote.key ?? quote.id,
      companyId: quote.companyKey ?? "",
      companyName: quote.companyName ?? quote.companyKey ?? "",
      companyKey: quote.companyKey ?? "",
      customerId: quote.customerId ?? "",
      customerName: quote.customerEmail ?? "--",
      customerEmail: quote.customerEmail ?? "--",
      status: quote.status ?? "Submitted",
      negotiatedTotal: moneyToNumber(quote.totalPrice),
      validUntil: "",
      createdAt: quote.createdAt ?? "",
    }));
  }, [data?.quotes.results]);

  return {
    carts,
    orders,
    quotes,
    loading,
    error,
  };
}
