"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CsaAssistant } from "../csa-assistant/index.js";
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
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardMetric,
  Tabs,
  Accordion,
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

const auditEventsData = [
  ["Ticket created", "agent@csa.local", "Tickets", "CSA-1024", "8 min ago"],
  ["Order lookup", "agent@csa.local", "Orders", "ORD-54019", "18 min ago"],
  ["AI summary generated", "ai-assist", "CSA Assistant", "session-76", "26 min ago"]
];

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

export function ProductsPageView() {
  const router = useRouter();
  return (
    <>
      <PageHeader
        description="Search catalog projections with product type, key, SKU, price, availability, and publication status."
        eyebrow="Product Search"
        title="Products"
      />
      <ModuleToolbar options={["Product Name", "Product Key", "SKU", "Product Type"]} searchPlaceholder="Search products..." />
      <Table>
        <TableHeader>
          <TableRow>
            {["Product Name", "Product Type", "Product Key", "SKU", "Price", "Availability", "Status"].map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {productsData.map((row, idx) => (
            <TableRow key={idx} clickable onClick={() => router.push(`/products/${row[2]}`)}>
              <TableCell className="font-bold text-m-primary">{row[0]}</TableCell>
              <TableCell>{row[1]}</TableCell>
              <TableCell><span className="font-mono text-xs">{row[2]}</span></TableCell>
              <TableCell><span className="font-mono text-xs">{row[3]}</span></TableCell>
              <TableCell className="font-semibold">{row[4]}</TableCell>
              <TableCell><Badge variant="success" size="sm" dot>{row[5]}</Badge></TableCell>
              <TableCell><Badge variant="primary" size="sm">{row[6]}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TablePagination page={1} totalPages={1} totalItems={productsData.length} onPageChange={() => {}} />
      </Table>
    </>
  );
}

export function ReportsPageView() {
  return (
    <>
      <PageHeader
        actions={
          <Button variant="primary" size="md" leftIcon={<Icon name="download" size="xs" />}>
            Export Report
          </Button>
        }
        description="Export operational reports for tickets, orders, carts, customers, products, SLA, and AI usage."
        eyebrow="Analytics & Insights"
        title="Reports"
      />

      <Tabs defaultValue="tickets" variant="pill" className="mb-6">
        <Tabs.List>
          <Tabs.Trigger value="tickets">Tickets</Tabs.Trigger>
          <Tabs.Trigger value="orders">Orders</Tabs.Trigger>
          <Tabs.Trigger value="carts">Carts</Tabs.Trigger>
          <Tabs.Trigger value="customer">Customer</Tabs.Trigger>
          <Tabs.Trigger value="product">Product</Tabs.Trigger>
          <Tabs.Trigger value="sla">SLA</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardMetric title="Sessions" value="214" subtitle="Selected period" trend={{ value: "8%", direction: "up" }} />
        <CardMetric title="Messages" value="1.8k" subtitle="AI and agent activity" trend={{ value: "14%", direction: "up" }} />
        <CardMetric title="Tokens" value="842k" subtitle="Gateway usage" />
        <CardMetric title="Cost" value="$42.18" subtitle="Estimated" trend={{ value: "3%", direction: "down" }} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card variant="default">
          <CardHeader>
            <CardTitle>Daily Activity Bar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-2 pt-4">
              {[42, 64, 48, 88, 72, 96, 58, 112, 84, 76, 104, 68].map((height, index) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={index}>
                  <div className="w-full rounded-t-m-sm bg-m-primary transition-all hover:bg-m-primary-600" style={{ height }} />
                  <span className="text-[10px] text-m-text-muted">{index + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Top Performing Agents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["agent@csa.local", "420", "128k", "$12.20"],
                  ["ops@csa.local", "312", "88k", "$8.40"],
                  ["admin@csa.local", "206", "61k", "$5.10"]
                ].map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold">{row[0]}</TableCell>
                    <TableCell>{row[1]}</TableCell>
                    <TableCell>{row[2]}</TableCell>
                    <TableCell>{row[3]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export function KnowledgeBasePageView() {
  return (
    <>
      <PageHeader
        description="Agent-facing FAQ and troubleshooting repository with categorized article tabs."
        eyebrow="Knowledge Base"
        title="Knowledge Base"
      />

      <Tabs defaultValue="faq" variant="underline" className="mb-6">
        <Tabs.List>
          <Tabs.Trigger value="faq" icon={<Icon name="help-circle" size="xs" />}>Frequently Asked Questions</Tabs.Trigger>
          <Tabs.Trigger value="troubleshoot" icon={<Icon name="wrench" size="xs" />}>Troubleshooting Guides</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="faq">
          <Accordion type="single" defaultValue="item-1">
            <Accordion.Item value="item-1">
              <Accordion.Trigger>What omnichannel services are supported?</Accordion.Trigger>
              <Accordion.Content>
                Multi-channel support ticketing, intelligent agent routing, analytics, order management context, and automated AI assistance.
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="item-2">
              <Accordion.Trigger>What payment methods are supported?</Accordion.Trigger>
              <Accordion.Content>
                Credit cards, debit cards, PayPal, Klarna, B2B purchase orders, and custom gateway integrations.
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="item-3">
              <Accordion.Trigger>Can agents manage multiple customer sessions in parallel?</Accordion.Trigger>
              <Accordion.Content>
                Yes. The Meridian workspace supports concurrent ticket handling with priority queues and instant customer 360 views.
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </Tabs.Content>

        <Tabs.Content value="troubleshoot">
          <Accordion type="single" defaultValue="item-1">
            <Accordion.Item value="item-1">
              <Accordion.Trigger>Customer login failure resolution</Accordion.Trigger>
              <Accordion.Content>
                Verify client domain, check identity provider state, then trigger password reset or clear active session token.
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="item-2">
              <Accordion.Trigger>Discount code not applying to cart</Accordion.Trigger>
              <Accordion.Content>
                Inspect cart line items, verify promotion minimum spend requirements, and re-apply discount via cart connector API.
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </Tabs.Content>
      </Tabs>
    </>
  );
}

export function CsaAssistantPageView() {
  return (
    <>
      <PageHeader
        description="Three-pane AI assistant workspace for conversations, live tools, and customer context."
        eyebrow="AI Assistant"
        title="CSA Assistant"
      />
      <CsaAssistant />
    </>
  );
}

export function AuditLogPageView() {
  return (
    <>
      <PageHeader
        description="Review security audit trail, agent actions, AI assistant tool calls, and platform configuration changes."
        eyebrow="Administration"
        title="Audit Log"
      />
      <ModuleToolbar actionLabel="Export Audit" options={["All Modules", "Tickets", "Orders", "CSA Assistant"]} searchPlaceholder="Search audit log..." />
      <ModuleDataTable
        columns={["Action", "Actor", "Module", "Entity", "Time"]}
        rows={auditEventsData}
      />
    </>
  );
}
