"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Button,
  Icon,
  SearchBar,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  Badge,
  Skeleton,
  EmptyState,
  Panel,
  useDataTable,
} from "@csa/ui";
import { formatDate } from "@/lib/format-date";
import { SectionCard } from "@/components/detail";
import { useCustomerStore } from "../hooks/use-customers";
import type { Customer, CustomerListFilters } from "../types/customer-types";

const SEARCH_OPTIONS = [
  { value: "allFields", label: "All fields" },
  { value: "email", label: "Email" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "companyName", label: "Company" },
  { value: "customerNumber", label: "Customer number" },
  { value: "externalId", label: "External Id" },
  { value: "key", label: "Customer key" },
  { value: "id", label: "Customer id" },
];

const INITIAL_FILTERS: CustomerListFilters = {
  searchOption: "allFields",
  searchText: "",
  customerGroupId: "",
  filterJoinMode: "and",
  groupAssignmentsId: "",
  groupAssignmentsOperator: "is",
  dateOfBirthFrom: "",
  dateOfBirthTo: "",
  dateCreatedFrom: "",
  dateCreatedTo: "",
  dateModifiedFrom: "",
  dateModifiedTo: "",
};

export function CustomerListView() {
  const router = useRouter();
  const { customers, groups, loading, error, refetch } = useCustomerStore();

  const [filters, setFilters] = useState<CustomerListFilters>(INITIAL_FILTERS);
  const [draftFilters, setDraftFilters] = useState<CustomerListFilters>(INITIAL_FILTERS);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupSelectOptions = useMemo(() => {
    return [
      { value: "", label: "All customer groups" },
      ...groups.map((g) => ({ value: g.id, label: g.name })),
    ];
  }, [groups]);

  const hasActiveAdvancedFilters = useMemo(() => {
    return Boolean(
      filters.groupAssignmentsId ||
        filters.dateOfBirthFrom ||
        filters.dateOfBirthTo ||
        filters.dateCreatedFrom ||
        filters.dateCreatedTo ||
        filters.dateModifiedFrom ||
        filters.dateModifiedTo
    );
  }, [filters]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      // 1. Group Quick Filter
      if (filters.customerGroupId && cust.customerGroup?.id !== filters.customerGroupId) {
        return false;
      }

      // 2. Search Text
      if (filters.searchText.trim()) {
        const query = filters.searchText.toLowerCase().trim();
        const option = filters.searchOption;

        if (option === "email") {
          if (!cust.email.toLowerCase().includes(query)) return false;
        } else if (option === "firstName") {
          if (!cust.firstName?.toLowerCase().includes(query)) return false;
        } else if (option === "lastName") {
          if (!cust.lastName?.toLowerCase().includes(query)) return false;
        } else if (option === "companyName") {
          if (!cust.companyName?.toLowerCase().includes(query)) return false;
        } else if (option === "customerNumber") {
          if (!cust.customerNumber?.toLowerCase().includes(query)) return false;
        } else if (option === "externalId") {
          if (!cust.externalId?.toLowerCase().includes(query)) return false;
        } else if (option === "id") {
          if (!cust.id.toLowerCase().includes(query)) return false;
        } else {
          // allFields
          const match =
            cust.email.toLowerCase().includes(query) ||
            (cust.firstName && cust.firstName.toLowerCase().includes(query)) ||
            (cust.lastName && cust.lastName.toLowerCase().includes(query)) ||
            (cust.companyName && cust.companyName.toLowerCase().includes(query)) ||
            (cust.customerNumber && cust.customerNumber.toLowerCase().includes(query)) ||
            (cust.externalId && cust.externalId.toLowerCase().includes(query)) ||
            cust.id.toLowerCase().includes(query);
          if (!match) return false;
        }
      }

      // 3. Advanced Group Assignment Filter
      if (filters.groupAssignmentsId) {
        const isMatch = cust.customerGroup?.id === filters.groupAssignmentsId;
        if (filters.groupAssignmentsOperator === "is" && !isMatch) return false;
        if (filters.groupAssignmentsOperator === "isNot" && isMatch) return false;
      }

      // 4. Date Created Filter
      if (filters.dateCreatedFrom) {
        if (new Date(cust.createdAt) < new Date(filters.dateCreatedFrom)) return false;
      }
      if (filters.dateCreatedTo) {
        if (new Date(cust.createdAt) > new Date(filters.dateCreatedTo)) return false;
      }

      return true;
    });
  }, [customers, filters]);

  const {
    page: currentPage,
    paginatedRows: paginatedCustomers,
    resetPage,
    setPage: setCurrentPage,
    sortDirection,
    sortKey: sortColumn,
    sortedRows: sortedCustomers,
    totalItems,
    totalPages,
    onSort: handleSort,
  } = useDataTable<Customer, keyof Customer>({
    rows: filteredCustomers,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
    pageSize: 10,
  });
  const isLoading = loading || isRefreshing;

  const applyAdvancedFilters = () => {
    setFilters(draftFilters);
    setShowFiltersPanel(false);
    resetPage();
  };

  const clearAdvancedFilters = () => {
    const reset = {
      ...filters,
      groupAssignmentsId: "",
      groupAssignmentsOperator: "is" as const,
      dateOfBirthFrom: "",
      dateOfBirthTo: "",
      dateCreatedFrom: "",
      dateCreatedTo: "",
      dateModifiedFrom: "",
      dateModifiedTo: "",
    };
    setDraftFilters(reset);
    setFilters(reset);
    resetPage();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Customer Directory"
        subtitle="Search customer records, filter by group, and open 360 views for support follow-up."
        badge={<Badge variant="primary">Customer Operations</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/customers/create">
              <Button variant="primary" size="md" leftIcon={<Icon name="plus" size="xs" />}>
                Add Customer
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="refresh-cw" size="xs" />}
              onClick={handleRefresh}
            >
              {isLoading ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        }
      />

      {/* Search row — flat, no card */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-48">
            <Select
              value={filters.searchOption}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, searchOption: e.target.value }));
                resetPage();
              }}
              options={SEARCH_OPTIONS}
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <SearchBar
              value={filters.searchText}
              onChange={(val) => {
                const text = typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value;
                setFilters((prev) => ({ ...prev, searchText: text }));
                resetPage();
              }}
              onClear={() => {
                setFilters((prev) => ({ ...prev, searchText: "" }));
                resetPage();
              }}
              placeholder="Search customers by email, name, number..."
            />
          </div>
          <div className="w-48">
            <Select
              value={filters.customerGroupId}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, customerGroupId: e.target.value }));
                resetPage();
              }}
              options={groupSelectOptions}
            />
          </div>
          <Button
            variant={hasActiveAdvancedFilters ? "primary" : "secondary"}
            size="md"
            leftIcon={<Icon name="filter" size="xs" />}
            onClick={() => setShowFiltersPanel((prev) => !prev)}
          >
            {hasActiveAdvancedFilters ? "Filters •" : "Filters"}
          </Button>
        </div>

        {/* Advanced Filters Drawer Panel */}
        {showFiltersPanel && (
          <Panel className="p-4 bg-m-bg-surface space-y-4 border border-m-border rounded-lg">
            <div className="flex items-center justify-between border-b border-m-border/60 pb-3">
              <h4 className="text-sm font-bold text-m-text">Advanced Customer Filters</h4>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-m-text-muted font-medium">Join mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-m-text">
                  <input
                    type="radio"
                    name="join-mode"
                    checked={draftFilters.filterJoinMode === "and"}
                    onChange={() => setDraftFilters((prev) => ({ ...prev, filterJoinMode: "and" }))}
                  />
                  <span>AND</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-m-text">
                  <input
                    type="radio"
                    name="join-mode"
                    checked={draftFilters.filterJoinMode === "or"}
                    onChange={() => setDraftFilters((prev) => ({ ...prev, filterJoinMode: "or" }))}
                  />
                  <span>OR</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Group Assignment Operator */}
              <div className="space-y-2">
                <label className="font-semibold text-m-text">Customer Group Assignment</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="group-op"
                      checked={draftFilters.groupAssignmentsOperator === "is"}
                      onChange={() =>
                        setDraftFilters((prev) => ({ ...prev, groupAssignmentsOperator: "is" }))
                      }
                    />
                    <span>is</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="group-op"
                      checked={draftFilters.groupAssignmentsOperator === "isNot"}
                      onChange={() =>
                        setDraftFilters((prev) => ({ ...prev, groupAssignmentsOperator: "isNot" }))
                      }
                    />
                    <span>is not</span>
                  </label>
                </div>
                <Select
                  value={draftFilters.groupAssignmentsId ?? ""}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({ ...prev, groupAssignmentsId: e.target.value }))
                  }
                  options={groupSelectOptions}
                />
              </div>

              {/* Date Created Range */}
              <div className="space-y-2">
                <label className="font-semibold text-m-text">Date Created Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="p-1.5 border border-m-border rounded text-xs text-m-text bg-transparent"
                    value={draftFilters.dateCreatedFrom ?? ""}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, dateCreatedFrom: e.target.value }))
                    }
                  />
                  <input
                    type="date"
                    className="p-1.5 border border-m-border rounded text-xs text-m-text bg-transparent"
                    value={draftFilters.dateCreatedTo ?? ""}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, dateCreatedTo: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Date Modified Range */}
              <div className="space-y-2">
                <label className="font-semibold text-m-text">Date Modified Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="p-1.5 border border-m-border rounded text-xs text-m-text bg-transparent"
                    value={draftFilters.dateModifiedFrom ?? ""}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, dateModifiedFrom: e.target.value }))
                    }
                  />
                  <input
                    type="date"
                    className="p-1.5 border border-m-border rounded text-xs text-m-text bg-transparent"
                    value={draftFilters.dateModifiedTo ?? ""}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, dateModifiedTo: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-m-border/60">
              <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}>
                Clear
              </Button>
              <Button variant="primary" size="sm" onClick={applyAdvancedFilters}>
                Apply Filters
              </Button>
            </div>
          </Panel>
        )}
      </div>

      {error && (
        <Panel className="p-4 rounded-lg border border-m-danger/30 bg-m-danger-surface text-sm text-m-danger">
          Unable to load customers from the BFF. Check that the BFF is running and federated with the commerce service.
        </Panel>
      )}

      {/* Records — one quiet container */}
      <SectionCard
        title={`Customers${sortedCustomers.length ? ` (${sortedCustomers.length})` : ""}`}
        bodyClassName={isLoading || sortedCustomers.length === 0 ? "p-4" : "p-0"}
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={40} className="w-full rounded-md" />
            ))}
          </div>
        ) : sortedCustomers.length === 0 ? (
          <EmptyState
            title="No Customers Found"
            description="No customer records match your filter criteria or search parameters."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setFilters(INITIAL_FILTERS);
                  setDraftFilters(INITIAL_FILTERS);
                }}
              >
                Reset Search & Filters
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort("id")} className="cursor-pointer">
                    Customer ID {sortColumn === "id" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead onClick={() => handleSort("customerNumber")} className="cursor-pointer">
                    Customer No {sortColumn === "customerNumber" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead onClick={() => handleSort("firstName")} className="cursor-pointer">
                    First Name {sortColumn === "firstName" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead onClick={() => handleSort("lastName")} className="cursor-pointer">
                    Last Name {sortColumn === "lastName" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead onClick={() => handleSort("companyName")} className="cursor-pointer">
                    Company {sortColumn === "companyName" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead onClick={() => handleSort("email")} className="cursor-pointer">
                    Email {sortColumn === "email" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Customer Group</TableHead>
                  <TableHead onClick={() => handleSort("createdAt")} className="cursor-pointer">
                    Date Created {sortColumn === "createdAt" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((cust) => (
                  <TableRow
                    key={cust.id}
                    clickable
                    onClick={() => router.push(`/customers/${cust.id}`)}
                  >
                    <TableCell className="font-mono text-xs font-bold text-m-primary">
                      <Link href={`/customers/${cust.id}`} className="hover:underline">
                        {cust.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium text-m-text">
                      {cust.customerNumber ?? "--"}
                    </TableCell>
                    <TableCell className="font-semibold text-m-text">{cust.firstName ?? "--"}</TableCell>
                    <TableCell className="font-semibold text-m-text">{cust.lastName ?? "--"}</TableCell>
                    <TableCell className="text-m-text">{cust.companyName ?? "--"}</TableCell>
                    <TableCell className="text-m-primary font-medium">{cust.email}</TableCell>
                    <TableCell>
                      {cust.customerGroup ? (
                        <Badge variant="neutral" size="sm">
                          {cust.customerGroup.name}
                        </Badge>
                      ) : (
                        "--"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-m-text-muted">
                      {formatDate(cust.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-m-border/60 px-4 py-3">
              <TablePagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
