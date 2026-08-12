"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  SearchBar,
  Select,
  EmptyState,
  Skeleton,
} from "@csa/ui";
import { useQuotes } from "../hooks/use-quotes";
import { QuoteStatusChip } from "./QuoteStatusChip";
import { useCompanies } from "@/features/companies/hooks/use-companies";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "In Review", label: "In Review" },
  { value: "Approved", label: "Approved" },
  { value: "Declined", label: "Declined" },
  { value: "Converted", label: "Converted" },
];

export function QuoteListView() {
  const router = useRouter();
  const {
    quotes,
    totalItems,
    loading,
    filter,
    sort,
    page,
    perPage,
    setFilter,
    setSort,
    setPage,
    setPerPage,
  } = useQuotes();

  const { allCompanies } = useCompanies();

  const [searchText, setSearchText] = useState("");

  const companyOptions = [
    { value: "", label: "All Companies" },
    ...allCompanies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleSearchSubmit = () => {
    setFilter({
      ...filter,
      searchText,
    });
    setPage(1);
  };

  const handleReset = () => {
    setSearchText("");
    setFilter({ searchText: "", statusFilter: "", companyIdFilter: "" });
    setPage(1);
  };

  const handleSort = (key: typeof sort.key) => {
    setSort({
      key,
      order: sort.key === key && sort.order === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Quotes"
        subtitle="B2B quote requests, merchant offers, and negotiation state."
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            B2B Operations
          </span>
        }
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Icon name="plus" size="xs" />}
            onClick={() => router.push("/b2b/quotes/create")}
          >
            Create quote
          </Button>
        }
      />

      {/* Toolbar Panel */}
      <Panel>
        <div className="flex flex-col sm:flex-row items-center gap-3 p-4">
          <div className="flex-1 min-w-0 w-full">
            <SearchBar
              value={searchText}
              onChange={(val) => setSearchText(val)}
              onSearch={handleSearchSubmit}
              onClear={() => setSearchText("")}
              placeholder="Search quotes by ID, company, or customer..."
              size="md"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={filter.companyIdFilter ?? ""}
              options={companyOptions}
              onChange={(e) => {
                setFilter({ ...filter, companyIdFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="w-full sm:w-40">
            <Select
              value={filter.statusFilter ?? ""}
              options={STATUS_OPTIONS}
              onChange={(e) => {
                setFilter({ ...filter, statusFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="primary" size="md" onClick={handleSearchSubmit}>
              Search
            </Button>
            {(filter.searchText || filter.statusFilter || filter.companyIdFilter) && (
              <Button variant="ghost" size="md" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Quotes Table */}
      <Panel title={`Quotes (${totalItems})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                sortable
                sortDirection={sort.key === "quoteNumber" ? sort.order : false}
                onSort={() => handleSort("quoteNumber")}
              >
                Quote ID
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "companyName" ? sort.order : false}
                onSort={() => handleSort("companyName")}
              >
                Company / Business Unit
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "customerName" ? sort.order : false}
                onSort={() => handleSort("customerName")}
              >
                Customer
              </TableHead>
              <TableHead>Items</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "negotiatedTotal" ? sort.order : false}
                onSort={() => handleSort("negotiatedTotal")}
              >
                Value / Total
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "validUntil" ? sort.order : false}
                onSort={() => handleSort("validUntil")}
              >
                Valid Until
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "createdAt" ? sort.order : false}
                onSort={() => handleSort("createdAt")}
              >
                Requested Date
              </TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton width="80%" height={16} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12">
                  <EmptyState
                    icon="file-text"
                    title="No Quotes Found"
                    description="No quote requests or offers match your current criteria. Try resetting filters or creating a new quote."
                    action={
                      <Button variant="secondary" onClick={handleReset}>
                        Reset Filters
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q) => (
                <TableRow
                  key={q.id}
                  clickable
                  onClick={() => router.push(`/b2b/quotes/${q.id}`)}
                >
                  <TableCell className="font-mono text-xs font-semibold text-m-primary">
                    {q.quoteNumber}
                  </TableCell>
                  <TableCell className="font-semibold text-m-text">{q.companyName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-m-text">{q.customerName}</span>
                      <span className="text-[11px] text-m-text-muted">{q.customerEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-m-text-muted">
                    {q.lineItems.length} {q.lineItems.length === 1 ? "item" : "items"}
                  </TableCell>
                  <TableCell className="font-semibold text-m-text">
                    ${q.negotiatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <QuoteStatusChip status={q.status} />
                  </TableCell>
                  <TableCell className="text-m-text-muted">
                    {new Date(q.validUntil).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-m-text-muted">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      leftIcon={<Icon name="chevron-right" size="xs" />}
                      onClick={() => router.push(`/b2b/quotes/${q.id}`)}
                      aria-label="View Quote"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalItems > 0 && (
          <TablePagination
            page={page}
            totalPages={Math.ceil(totalItems / perPage)}
            totalItems={totalItems}
            pageSize={perPage}
            onPageChange={setPage}
            onPageSizeChange={setPerPage}
          />
        )}
      </Panel>
    </div>
  );
}
