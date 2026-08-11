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
  Avatar,
  Icon
} from "@csa/ui";
import { PageHeader } from "./PageHeader";

const ticketsData = [
  ["CSA-1024", "Mia Johnson", "Phone", "Open", "High", "Delivery", "Order delayed after payment capture", "A. Kumar"],
  ["CSA-1025", "Rahul Mehta", "Email", "In progress", "Normal", "Cart", "Discount code not applied", "S. Patel"],
  ["CSA-1026", "Sofia Garcia", "Chat", "Waiting", "Low", "Product", "Availability confirmation", "Queue"]
];

const customersData = [
  ["cst-1001", "Mia", "Johnson", "Northwind Retail", "mia@example.com", "Gold", "2026-08-01"],
  ["cst-1002", "Rahul", "Mehta", "Acme Supply", "rahul@example.com", "B2B buyer", "2026-07-29"],
  ["cst-1003", "Sofia", "Garcia", "Individual", "sofia@example.com", "Retail", "2026-07-25"]
];

const ordersData = [
  ["ORD-54019", "Mia Johnson", "mia@example.com", "$342.20", "4", "Processing", "Pending", "2026-08-05"],
  ["ORD-54020", "Rahul Mehta", "rahul@example.com", "$89.00", "2", "Shipped", "Paid", "2026-08-05"],
  ["ORD-54021", "Sofia Garcia", "sofia@example.com", "$1,240.00", "6", "Payment review", "Review", "2026-08-04"]
];

const cartsData = [
  ["CRT-881", "--", "Mia Johnson", "$184.20", "4", "Active", "2026-08-05", "2026-08-05"],
  ["CRT-882", "--", "Rahul Mehta", "$89.00", "2", "Merged", "2026-08-04", "2026-08-05"],
  ["CRT-883", "--", "Sofia Garcia", "$1,240.00", "6", "Quote requested", "2026-08-03", "2026-08-04"]
];

const productsData = [
  ["Warehouse Trolley", "Industrial equipment", "warehouse-trolley", "WT-100", "$249.00", "In stock", "Published"],
  ["Safety Gloves", "PPE", "safety-gloves", "SG-240", "$12.50", "In stock", "Published"],
  ["Packing Tape", "Packaging", "packing-tape", "PT-500", "$6.20", "Low stock", "Published"]
];
// Note: productsData is kept for reference only; ProductsPageView now delegates to
// the full-parity ProductListView (features/products/components/ProductListView.tsx).
void productsData;

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
        rows={ticketsData}
        routePrefix="/tickets"
      />
    </>
  );
}

export function CustomersPageView() {
  const router = useRouter();
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
      <Table>
        <TableHeader>
          <TableRow>
            {["Customer ID", "First Name", "Last Name", "Company", "Email", "Group", "Date Created"].map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {customersData.map((row, idx) => (
            <TableRow key={idx} clickable onClick={() => router.push(`/customers/${row[0]}`)}>
              <TableCell className="font-bold text-m-primary">{row[0]}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar name={`${row[1]} ${row[2]}`} size="xs" />
                  <span>{row[1]}</span>
                </div>
              </TableCell>
              <TableCell>{row[2]}</TableCell>
              <TableCell>{row[3]}</TableCell>
              <TableCell>{row[4]}</TableCell>
              <TableCell><Badge variant="primary" size="sm">{row[5]}</Badge></TableCell>
              <TableCell>{row[6]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TablePagination page={1} totalPages={1} totalItems={customersData.length} onPageChange={() => {}} />
      </Table>
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
        rows={ordersData}
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
        rows={cartsData}
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

