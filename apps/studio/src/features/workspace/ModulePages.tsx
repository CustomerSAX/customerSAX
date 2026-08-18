"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CsaAssistant } from "../csa-assistant/index";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  Toolbar as MeridianToolbar,
  Badge,
  Button,
  SearchBar,
  Select,
  Icon
} from "@csa/ui";
import { PageHeader } from "./PageHeader";

function ModuleToolbar({
  actionLabel,
  options,
  searchPlaceholder = "Search..."
}: {
  actionLabel?: string;
  options: string[];
  searchPlaceholder?: string;
}) {
  return (
    <MeridianToolbar
      left={
        <>
          <Select
            size="md"
            options={options.map((opt) => ({ value: opt.toLowerCase().replace(/\s+/g, "-"), label: opt }))}
            className="w-44"
          />
          <SearchBar placeholder={searchPlaceholder} className="w-64" />
        </>
      }
      right={
        <>
          <Button variant="secondary" size="md" leftIcon={<Icon name="sliders-horizontal" size="xs" />}>
            Filters
          </Button>
          <Button variant="secondary" size="md" leftIcon={<Icon name="refresh-cw" size="xs" />}>
            Refresh
          </Button>
          {actionLabel && (
            <Button variant="primary" size="md" leftIcon={<Icon name="plus" size="xs" />}>
              {actionLabel}
            </Button>
          )}
        </>
      }
      className="mb-5"
    />
  );
}

function StatusBadge({ value }: { value: string }) {
  const lowered = value.toLowerCase();
  const variant =
    lowered.includes("high") || lowered.includes("review") || lowered.includes("error")
      ? "error"
      : lowered.includes("normal") || lowered.includes("pending") || lowered.includes("waiting") || lowered.includes("low stock")
      ? "warning"
      : "success";

  return (
    <Badge variant={variant} appearance="subtle" size="sm" dot>
      {value}
    </Badge>
  );
}

function ModuleDataTable({
  columns,
  rows,
  routePrefix
}: {
  columns: string[];
  rows: string[][];
  routePrefix?: string;
}) {
  const [page, setPage] = useState(1);
  const router = useRouter();

  const handleRowClick = (id: string) => {
    if (routePrefix) {
      router.push(`${routePrefix}/${id}`);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col}>{col}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow key={idx} clickable onClick={() => handleRowClick(row[0])}>
            {row.map((cell, cIdx) => (
              <TableCell key={cIdx} className={cIdx === 0 ? "font-bold text-m-primary" : ""}>
                {cIdx >= 3 && cIdx <= 5 ? <StatusBadge value={cell} /> : cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      <TablePagination
        as="tfoot"
        page={page}
        totalPages={1}
        totalItems={rows.length}
        pageSize={10}
        onPageChange={setPage}
      />
    </Table>
  );
}

export function TicketsPageView() {
  return (
    <>
      <PageHeader
        description="Manage cases with ticket identifier, source, status, priority, category, subject, and assignee controls."
        eyebrow="Ticket Operations"
        title="Tickets"
      />
      <ModuleToolbar
        actionLabel="Create Ticket"
        options={["All Fields", "Ticket Number", "Customer Email", "Subject"]}
        searchPlaceholder="Search tickets..."
      />
      <ModuleDataTable
        columns={["Ticket Number", "Customer", "Source", "Status", "Priority", "Category", "Subject", "Assignee"]}
        rows={[]}
        routePrefix="/tickets"
      />
    </>
  );
}

export function CustomersPageView() {
  return (
    <>
      <PageHeader
        description="Search customer profiles by identifiers, names, company, email, group, and activity dates."
        eyebrow="Customer Operations"
        title="Customers"
      />
      <ModuleToolbar
        actionLabel="Create Customer"
        options={["All Fields", "Email", "First Name", "Last Name", "Company"]}
        searchPlaceholder="Search customers..."
      />
      <ModuleDataTable
        columns={["Customer ID", "First Name", "Last Name", "Company", "Email", "Group", "Date Created"]}
        rows={[]}
        routePrefix="/customers"
      />
    </>
  );
}

export function OrdersPageView() {
  return (
    <>
      <PageHeader
        description="Review order number, customer, totals, item counts, order state, payment state, and created dates."
        eyebrow="Order Operations"
        title="Orders"
      />
      <ModuleToolbar options={["All Fields", "Customer Email", "Order Number", "SKU", "Order Status"]} searchPlaceholder="Search orders..." />
      <ModuleDataTable
        columns={["Order Number", "Customer", "Customer Email", "Order Total", "Items", "Order Status", "Payment Status", "Created"]}
        rows={[]}
        routePrefix="/orders"
      />
    </>
  );
}

export function CartPageView() {
  return (
    <>
      <PageHeader
        description="Review active carts, cart ownership, item counts, totals, and checkout readiness."
        eyebrow="Cart Operations"
        title="Carts"
      />
      <ModuleToolbar options={["Cart ID", "Customer Email"]} searchPlaceholder="Search carts..." />
      <ModuleDataTable
        columns={["Cart ID", "Order Number", "Customer", "Cart Total", "Items", "Cart Status", "Created", "Modified"]}
        rows={[]}
        routePrefix="/cart"
      />
    </>
  );
}

export { ProductListView as ProductsPageView } from "../products/components/ProductListView";


export function CsaAssistantPageView() {
  return (
    <CsaAssistant />
  );
}
