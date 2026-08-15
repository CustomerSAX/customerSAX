"use client";

import { useState, useCallback, useMemo } from "react";
import type { Company, CompanyAddress, CompanyAssociate, CompanyFilter, CompanySort } from "../types/company-types";
import { INITIAL_COMPANIES } from "../constants/mock-companies";

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const loading = false;
  const [filter, setFilter] = useState<CompanyFilter>({ searchField: "all", searchText: "" });
  const [sort, setSort] = useState<CompanySort>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const filteredCompanies = useMemo(() => {
    let result = [...companies];

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
  }, [companies, filter, sort]);

  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredCompanies.slice(start, start + perPage);
  }, [filteredCompanies, page, perPage]);

  const getCompanyById = useCallback(
    (id: string) => companies.find((c) => c.id === id || c.key === id),
    [companies]
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
  }, []);

  const addCompanyAssociate = useCallback((companyId: string, associate: Omit<CompanyAssociate, "id">) => {
    const newAssoc: CompanyAssociate = {
      ...associate,
      id: `assoc-${Date.now()}`,
    };
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
  }, []);

  return {
    companies: paginatedCompanies,
    allCompanies: companies,
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
