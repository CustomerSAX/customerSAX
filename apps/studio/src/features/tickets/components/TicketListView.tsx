"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
  useDataTable,
} from "@csa/ui";
import { TicketAIQuickReview } from "./TicketAIQuickReview";
import { SectionCard } from "@csa/ui";
import { useTicketStore, TICKET_CATEGORIES } from "../hooks/use-tickets";
import { useRegisterPageContext } from "@/features/csa-assistant";
import type { Ticket, TicketStatus, TicketPriority } from "../types/ticket-types";
import { SlaBadge } from "./TicketSla";
import { SLA_SORT_KEY, ticketSlaState, useNow } from "../sla";
import { formatDateTime } from "@/lib/format-date";
import { useTablePaginationLabels } from "@/lib/use-table-pagination-labels";

export function TicketListView() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Tickets");
  const common = useTranslations("Common");
  const paginationLabels = useTablePaginationLabels();
  const now = useNow();
  const [slaFilter, setSlaFilter] = useState("");
  const [slaSorted, setSlaSorted] = useState(false);
  // Only 100 tickets are loaded, so SLA views ask the server for the soonest-due 100 across
  // all tickets rather than sorting/filtering whichever 100 were modified most recently.
  const slaView = slaSorted || slaFilter !== "";
  const { tickets, total, loading, error, refetch } = useTicketStore(
    undefined,
    slaView ? { sortKey: SLA_SORT_KEY, sortOrder: "asc" } : undefined
  );
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void refetch().catch(() => {}); }, 15000);
    return () => window.clearInterval(timer);
  }, [refetch]);

  const searchFieldOptions = [
    { value: "ticketNumber", label: t("ticketNumber") },
    { value: "email", label: t("customerEmail") },
    { value: "subject", label: t("subject") },
    { value: "allFields", label: common("allFields") },
  ];
  const statusFilterOptions = [
    { value: "", label: common("allStatuses") },
    ...(["Open", "In Progress", "Pending", "Resolved", "Closed"] as const).map((value) => ({
      value,
      label: t(`status.${value}`),
    })),
  ];
  const priorityFilterOptions = [
    { value: "", label: t("allPriorities") },
    ...(["Urgent", "High", "Medium", "Low"] as const).map((value) => ({
      value,
      label: t(`priority.${value}`),
    })),
  ];

  const slaFilterOptions = [
    { value: "", label: t("sla.allSla") },
    ...(["breached", "at_risk", "on_track", "paused"] as const).map((value) => ({
      value,
      label: t(`sla.state.${value}`),
    })),
  ];
  const slaAvailable = tickets.some((ticket) => ticket.sla?.metrics.length);

  const [searchOption, setSearchOption] = useState<"ticketNumber" | "email" | "subject" | "allFields">("ticketNumber");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // 1. Status Filter
      if (statusFilter && t.status !== statusFilter) {
        return false;
      }

      // 2. Priority Filter
      if (priorityFilter && t.priority !== priorityFilter) {
        return false;
      }

      if (slaFilter && ticketSlaState(t.sla, now) !== slaFilter) {
        return false;
      }

      // 3. Search Text Filter
      if (searchText.trim()) {
        const query = searchText.toLowerCase().trim();
        if (searchOption === "ticketNumber") {
          if (!t.ticketNumber.toLowerCase().includes(query)) return false;
        } else if (searchOption === "email") {
          if (!t.email.toLowerCase().includes(query)) return false;
        } else if (searchOption === "subject") {
          if (!t.subject.toLowerCase().includes(query)) return false;
        } else {
          // allFields
          const match =
            t.ticketNumber.toLowerCase().includes(query) ||
            t.email.toLowerCase().includes(query) ||
            t.subject.toLowerCase().includes(query) ||
            t.status.toLowerCase().includes(query) ||
            t.priority.toLowerCase().includes(query) ||
            t.assignedTo.toLowerCase().includes(query);
          if (!match) return false;
        }
      }

      return true;
    });
  }, [tickets, statusFilter, priorityFilter, slaFilter, now, searchText, searchOption]);

  const {
    page: currentPage,
    paginatedRows: paginatedTickets,
    resetPage,
    setPage: setCurrentPage,
    sortDirection,
    sortKey: sortColumn,
    totalItems,
    totalPages,
    onSort: handleSort,
  } = useDataTable<Ticket, keyof Ticket>({
    rows: filteredTickets,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
    pageSize: 10,
    // Soonest running deadline first; tickets with no running clock go last.
    getSortValue: (row, key) =>
      key === "sla" ? (row.sla?.nextDueAt ? Date.parse(row.sla.nextDueAt) : Number.POSITIVE_INFINITY) : row[key],
  });
  const sortBy = (key: keyof Ticket) => {
    setSlaSorted(key === "sla");
    handleSort(key);
  };

  const visibleTicketRecords = useMemo(
    () =>
      paginatedTickets.map((tk) => ({
        id: tk.id,
        identifier: tk.ticketNumber,
        label: `Ticket #${tk.ticketNumber}`,
        subtitle: tk.subject,
        status: tk.status,
        email: tk.email,
      })),
    [paginatedTickets]
  );

  useRegisterPageContext(
    "TicketListView",
    {
      pageType: "ticket_list",
      entityType: "ticket",
      type: "ticket",
      id: "",
      visibleRecords: visibleTicketRecords,
      activeFilters: {
        search: searchText || undefined,
        page: currentPage,
        limit: 10,
        totalCount: totalItems,
      },
    },
    [visibleTicketRecords, searchText, currentPage, totalItems]
  );

  const renderStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "Open":
        return <Badge variant="primary" size="sm" dot>{t("status.Open")}</Badge>;
      case "In Progress":
        return <Badge variant="warning" size="sm" dot>{t("status.In Progress")}</Badge>;
      case "Pending":
        return <Badge variant="neutral" size="sm">{t("status.Pending")}</Badge>;
      case "Resolved":
        return <Badge variant="success" size="sm">{t("status.Resolved")}</Badge>;
      case "Closed":
        return <Badge variant="neutral" size="sm">{t("status.Closed")}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const renderPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case "Urgent":
        return <Badge variant="error" size="sm">{t("priority.Urgent")}</Badge>;
      case "High":
        return <Badge variant="warning" size="sm">{t("priority.High")}</Badge>;
      case "Medium":
        return <Badge variant="primary" size="sm">{t("priority.Medium")}</Badge>;
      case "Low":
        return <Badge variant="neutral" size="sm">{t("priority.Low")}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{priority}</Badge>;
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Header */}
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        badge={<Badge variant="primary">{t("badge")}</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/tickets/create">
              <Button variant="primary" size="md" leftIcon={<Icon name="plus" size="xs" />}>
                {t("create")}
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="refresh-cw" size="xs" />}
              onClick={handleRefresh}
            >
              {common("refresh")}
            </Button>
          </div>
        }
      />

      {/* Search & Filters — flat, no card */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:w-48">
          <Select
            value={searchOption}
            onChange={(e) => {
              setSearchOption(e.target.value as "ticketNumber" | "email" | "subject" | "allFields");
              resetPage();
            }}
            options={searchFieldOptions}
          />
        </div>
        <div className="min-w-0 w-full sm:min-w-[220px] flex-1">
          <SearchBar
            value={searchText}
            onChange={(val) => {
              setSearchText(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value);
              resetPage();
            }}
            onClear={() => {
              setSearchText("");
              resetPage();
            }}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              resetPage();
            }}
            options={statusFilterOptions}
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              resetPage();
            }}
            options={priorityFilterOptions}
          />
        </div>
        {(slaAvailable || slaFilter) && (
          <div className="w-full sm:w-40">
            <Select
              value={slaFilter}
              onChange={(e) => {
                setSlaFilter(e.target.value);
                resetPage();
              }}
              options={slaFilterOptions}
            />
          </div>
        )}
      </div>
      {slaView && total !== undefined && total > tickets.length && (
        <p className="text-xs text-m-text-muted">{t("sla.soonestNote", { shown: tickets.length, total })}</p>
      )}

      {/* Tickets */}
      {loading && tickets.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} className="w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <SectionCard title={t("sectionTitle")}>
          <EmptyState title={t("loadError")} description={error.message} action={<Button variant="primary" size="sm" onClick={handleRefresh}>{common("retry")}</Button>} />
        </SectionCard>
      ) : totalItems === 0 ? (
        <SectionCard title={t("sectionTitle")}>
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSearchText("");
                  setStatusFilter("");
                  setPriorityFilter("");
                  setSlaFilter("");
                }}
              >
                {t("resetFilters")}
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard title={t("countTitle", { count: totalItems })} bodyClassName="p-0">
          {/* Keep identifiers and dates readable; only the table region scrolls. */}
          <Table
            caption={t("sectionTitle")}
            className="min-w-[1400px] whitespace-nowrap [overflow-wrap:normal]"
          >
            <TableHeader>
              <TableRow>
                <TableHead sortable onSort={() => sortBy("ticketNumber")} sortDirection={sortColumn === "ticketNumber" ? sortDirection : false}>
                  {t("ticketNumber")}
                </TableHead>
                <TableHead sortable onSort={() => sortBy("email")} sortDirection={sortColumn === "email" ? sortDirection : false}>
                  {t("customer")}
                </TableHead>
                <TableHead sortable onSort={() => sortBy("createdAt")} sortDirection={sortColumn === "createdAt" ? sortDirection : false}>
                  {common("created")}
                </TableHead>
                <TableHead sortable onSort={() => sortBy("lastModifiedAt")} sortDirection={sortColumn === "lastModifiedAt" ? sortDirection : false}>
                  {common("modified")}
                </TableHead>
                <TableHead>{t("source")}</TableHead>
                <TableHead sortable onSort={() => sortBy("status")} sortDirection={sortColumn === "status" ? sortDirection : false}>
                  {common("status")}
                </TableHead>
                <TableHead>AI Status</TableHead>
                <TableHead sortable onSort={() => sortBy("priority")} sortDirection={sortColumn === "priority" ? sortDirection : false}>
                  {t("priorityLabel")}
                </TableHead>
                <TableHead sortable onSort={() => sortBy("sla")} sortDirection={sortColumn === "sla" ? sortDirection : false}>
                  {t("sla.column")}
                </TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("subject")}</TableHead>
                <TableHead>{t("assignee")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTickets.map((ticket) => (
                <TableRow key={ticket.id} clickable onClick={() => router.push(`/tickets/${ticket.id}`)}>
                  <TableCell className="font-mono text-xs font-bold text-m-primary">
                    <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                      {ticket.ticketNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-m-primary">{ticket.email}</TableCell>
                  <TableCell className="text-xs text-m-text-muted">
                    {formatDateTime(ticket.createdAt, locale)}
                  </TableCell>
                  <TableCell className="text-xs text-m-text-muted">
                    {formatDateTime(ticket.lastModifiedAt, locale)}
                  </TableCell>
                  <TableCell>{t.has(`contactType.${ticket.contactType}`) ? t(`contactType.${ticket.contactType}`) : ticket.contactType}</TableCell>
                  <TableCell>{renderStatusBadge(ticket.status)}</TableCell>
                  <TableCell><TicketAIQuickReview ticket={ticket} onTicketChanged={refetch} /></TableCell>
                  <TableCell>{renderPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell><SlaBadge sla={ticket.sla} now={now} /></TableCell>
                  <TableCell className="text-xs font-medium">
                    {t.has(`categoryValues.${ticket.category}`)
                      ? t(`categoryValues.${ticket.category}`)
                      : TICKET_CATEGORIES[ticket.category] || ticket.category}
                  </TableCell>
                  <TableCell className="font-medium text-m-text">
                    <div className="w-64 whitespace-normal break-words">{ticket.subject}</div>
                  </TableCell>
                  <TableCell className="text-xs text-m-text-muted">{ticket.assignedTo}</TableCell>
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
              labels={paginationLabels}
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
