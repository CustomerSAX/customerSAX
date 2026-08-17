"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
} from "@csa/ui";
import { SectionCard } from "@/components/detail";
import { useTicketStore, TICKET_CATEGORIES } from "../hooks/use-tickets";
import type { Ticket, TicketStatus, TicketPriority } from "../types/ticket-types";

const SEARCH_FIELD_OPTIONS = [
  { value: "ticketNumber", label: "Ticket Number" },
  { value: "email", label: "Customer Email" },
  { value: "subject", label: "Subject" },
  { value: "allFields", label: "All fields" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "In Progress" },
  { value: "Pending", label: "Pending" },
  { value: "Resolved", label: "Resolved" },
  { value: "Closed", label: "Closed" },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "Urgent", label: "Urgent" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

export function TicketListView() {
  const router = useRouter();
  const { tickets, loading, error, refetch } = useTicketStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [searchOption, setSearchOption] = useState<"ticketNumber" | "email" | "subject" | "allFields">("ticketNumber");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [sortColumn, setSortColumn] = useState<keyof Ticket>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleSort = (column: keyof Ticket) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

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
  }, [tickets, statusFilter, priorityFilter, searchText, searchOption]);

  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      const valA = String(a[sortColumn] ?? "");
      const valB = String(b[sortColumn] ?? "");
      const res = valA.localeCompare(valB, undefined, { numeric: true });
      return sortDirection === "asc" ? res : -res;
    });
  }, [filteredTickets, sortColumn, sortDirection]);

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTickets.slice(start, start + pageSize);
  }, [sortedTickets, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / pageSize));

  const renderStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "Open":
        return <Badge variant="primary" size="sm" dot>Open</Badge>;
      case "In Progress":
        return <Badge variant="warning" size="sm" dot>In Progress</Badge>;
      case "Pending":
        return <Badge variant="neutral" size="sm">Pending</Badge>;
      case "Resolved":
        return <Badge variant="success" size="sm">Resolved</Badge>;
      case "Closed":
        return <Badge variant="neutral" size="sm">Closed</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const renderPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case "Urgent":
        return <Badge variant="error" size="sm">Urgent</Badge>;
      case "High":
        return <Badge variant="warning" size="sm">High</Badge>;
      case "Medium":
        return <Badge variant="primary" size="sm">Medium</Badge>;
      case "Low":
        return <Badge variant="neutral" size="sm">Low</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{priority}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Support Tickets"
        subtitle="Search, triage, prioritize, and resolve customer support tickets across all channels."
        badge={<Badge variant="primary">Helpdesk & Service Cloud</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/tickets/create">
              <Button variant="primary" size="md" leftIcon={<Icon name="plus" size="xs" />}>
                Create Ticket
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="refresh-cw" size="xs" />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Search & Filters — flat, no card */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-48">
          <Select
            value={searchOption}
            onChange={(e) => setSearchOption(e.target.value as any)}
            options={SEARCH_FIELD_OPTIONS}
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <SearchBar
            value={searchText}
            onChange={(val) => {
              setSearchText(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value);
              setCurrentPage(1);
            }}
            onClear={() => {
              setSearchText("");
              setCurrentPage(1);
            }}
            placeholder="Search tickets by number, email, or subject..."
          />
        </div>
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
        <div className="w-40">
          <Select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={PRIORITY_FILTER_OPTIONS}
          />
        </div>
      </div>

      {/* Tickets */}
      {loading && tickets.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} className="w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <SectionCard title="Tickets">
          <EmptyState title="Unable to load tickets" description={error.message} action={<Button variant="primary" size="sm" onClick={handleRefresh}>Retry</Button>} />
        </SectionCard>
      ) : sortedTickets.length === 0 ? (
        <SectionCard title="Tickets">
          <EmptyState
            title="No Tickets Found"
            description="There are currently no tickets matching your active search filters."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSearchText("");
                  setStatusFilter("");
                  setPriorityFilter("");
                }}
              >
                Reset Search Filters
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard title={`Tickets (${sortedTickets.length})`} bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort("ticketNumber")} className="cursor-pointer">
                  Ticket Number {sortColumn === "ticketNumber" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("email")} className="cursor-pointer">
                  Customer {sortColumn === "email" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("createdAt")} className="cursor-pointer">
                  Created {sortColumn === "createdAt" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("lastModifiedAt")} className="cursor-pointer">
                  Modified {sortColumn === "lastModifiedAt" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Source</TableHead>
                <TableHead onClick={() => handleSort("status")} className="cursor-pointer">
                  Status {sortColumn === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => handleSort("priority")} className="cursor-pointer">
                  Priority {sortColumn === "priority" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Assignee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTickets.map((t) => (
                <TableRow key={t.id} clickable onClick={() => router.push(`/tickets/${t.id}`)}>
                  <TableCell className="font-mono text-xs font-bold text-m-primary">
                    <Link href={`/tickets/${t.id}`} className="hover:underline">
                      {t.ticketNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-m-primary">{t.email}</TableCell>
                  <TableCell className="text-xs text-m-text-muted">
                    {mounted ? new Date(t.createdAt).toLocaleString() : t.createdAt.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-xs text-m-text-muted">
                    {t.lastModifiedAt && mounted ? new Date(t.lastModifiedAt).toLocaleString() : t.lastModifiedAt ? t.lastModifiedAt.slice(0, 10) : "--"}
                  </TableCell>
                  <TableCell>{t.contactType}</TableCell>
                  <TableCell>{renderStatusBadge(t.status)}</TableCell>
                  <TableCell>{renderPriorityBadge(t.priority)}</TableCell>
                  <TableCell className="text-xs font-medium">
                    {TICKET_CATEGORIES[t.category] || t.category}
                  </TableCell>
                  <TableCell className="font-medium text-m-text max-w-xs truncate">
                    {t.subject}
                  </TableCell>
                  <TableCell className="text-xs text-m-text-muted">{t.assignedTo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border-t border-m-border/60 px-4 py-3">
            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={sortedTickets.length}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
