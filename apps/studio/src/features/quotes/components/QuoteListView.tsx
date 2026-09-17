"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { formatDate } from "@/lib/format-date";
import { useTablePaginationLabels } from "@/lib/use-table-pagination-labels";
import { useQuotes } from "../hooks/use-quotes";
import { QuoteStatusChip } from "./QuoteStatusChip";
import { useCompanies } from "@/features/companies/hooks/use-companies";
import {
  baseQuoteStatusLabel,
  readQuoteWorkflowConvertedOrderId,
  readQuoteWorkflowReviewState,
  workflowStatusLabel,
} from "../utils/quote-workflow-status";

const QUOTE_STATUSES = ["Draft", "Requested", "Buyer Review", "Seller Review", "Changes Requested", "In Review", "Accepted", "Approved", "Rejected", "Declined", "Converted"] as const;

export function QuoteListView() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Quotes");
  const common = useTranslations("Common");
  const paginationLabels = useTablePaginationLabels();
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
  const statusOptions = [
    { value: "", label: common("allStatuses") },
    ...QUOTE_STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
  ];

  const companyOptions = [
    { value: "", label: t("allCompanies") },
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
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            {t("eyebrow")}
          </span>
        }
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Icon name="plus" size="xs" />}
            onClick={() => router.push("/b2b/quotes/create")}
          >
            {t("create")}
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
              placeholder={t("searchPlaceholder")}
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
              options={statusOptions}
              onChange={(e) => {
                setFilter({ ...filter, statusFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="primary" size="md" onClick={handleSearchSubmit}>
              {common("search")}
            </Button>
            {(filter.searchText || filter.statusFilter || filter.companyIdFilter) && (
              <Button variant="ghost" size="md" onClick={handleReset}>
                {common("reset")}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Quotes Table */}
      <Panel title={t("countTitle", { count: totalItems })}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                sortable
                sortDirection={sort.key === "quoteNumber" ? sort.order : false}
                onSort={() => handleSort("quoteNumber")}
              >
                {t("quoteId")}
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "companyName" ? sort.order : false}
                onSort={() => handleSort("companyName")}
              >
                {t("businessUnit")}
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "customerName" ? sort.order : false}
                onSort={() => handleSort("customerName")}
              >
                {t("customer")}
              </TableHead>
              <TableHead>{t("items")}</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "negotiatedTotal" ? sort.order : false}
                onSort={() => handleSort("negotiatedTotal")}
              >
                {t("total")}
              </TableHead>
              <TableHead>{common("status")}</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "validUntil" ? sort.order : false}
                onSort={() => handleSort("validUntil")}
              >
                {t("validUntil")}
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "createdAt" ? sort.order : false}
                onSort={() => handleSort("createdAt")}
              >
                {t("requestedDate")}
              </TableHead>
              <TableHead className="w-12 text-right">{common("actions")}</TableHead>
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
                    title={t("emptyTitle")}
                    description={t("emptyDescription")}
                    action={
                      <Button variant="secondary" onClick={handleReset}>
                        {t("resetFilters")}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q) => {
                const displayStatus = workflowStatusLabel(
                  baseQuoteStatusLabel(q.status),
                  readQuoteWorkflowReviewState(q.id),
                  readQuoteWorkflowConvertedOrderId(q.id)
                );

                return (
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
                      {t("itemCount", { count: q.itemCount ?? q.lineItems.length })}
                    </TableCell>
                    <TableCell className="font-semibold text-m-text">
                      {q.currencyCode || "USD"} {q.negotiatedTotal.toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <QuoteStatusChip status={displayStatus} label={t.has(`status.${displayStatus}`) ? t(`status.${displayStatus}`) : displayStatus} />
                    </TableCell>
                    <TableCell className="text-m-text-muted">
                      {formatDate(q.validUntil, locale)}
                    </TableCell>
                    <TableCell className="text-m-text-muted">
                      {formatDate(q.createdAt, locale)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        leftIcon={<Icon name="chevron-right" size="xs" />}
                        onClick={() => router.push(`/b2b/quotes/${q.id}`)}
                        aria-label={common("view", { entity: t("quote") })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
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
            labels={paginationLabels}
          />
        )}
      </Panel>
    </div>
  );
}
