"use client";

import { useState } from "react";
import {
  ChevronDown,
  Download,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  Send,
  SlidersHorizontal
} from "lucide-react";
import { PageHeader } from "./PageHeader";

const tickets = [
  ["CSA-1024", "Mia Johnson", "Phone", "Open", "High", "Delivery", "Order delayed after payment capture", "A. Kumar"],
  ["CSA-1025", "Rahul Mehta", "Email", "In progress", "Normal", "Cart", "Discount code not applied", "S. Patel"],
  ["CSA-1026", "Sofia Garcia", "Chat", "Waiting", "Low", "Product", "Availability confirmation", "Queue"]
];

const customers = [
  ["cst-1001", "Mia", "Johnson", "Northwind Retail", "mia@example.com", "Gold", "2026-08-01"],
  ["cst-1002", "Rahul", "Mehta", "Acme Supply", "rahul@example.com", "B2B buyer", "2026-07-29"],
  ["cst-1003", "Sofia", "Garcia", "Individual", "sofia@example.com", "Retail", "2026-07-25"]
];

const orders = [
  ["ORD-54019", "Mia Johnson", "mia@example.com", "$342.20", "4", "Processing", "Pending", "2026-08-05"],
  ["ORD-54020", "Rahul Mehta", "rahul@example.com", "$89.00", "2", "Shipped", "Paid", "2026-08-05"],
  ["ORD-54021", "Sofia Garcia", "sofia@example.com", "$1,240.00", "6", "Payment review", "Review", "2026-08-04"]
];

const carts = [
  ["CRT-881", "--", "Mia Johnson", "$184.20", "4", "Active", "2026-08-05", "2026-08-05"],
  ["CRT-882", "--", "Rahul Mehta", "$89.00", "2", "Merged", "2026-08-04", "2026-08-05"],
  ["CRT-883", "--", "Sofia Garcia", "$1,240.00", "6", "Quote requested", "2026-08-03", "2026-08-04"]
];

const products = [
  ["Warehouse Trolley", "Industrial equipment", "warehouse-trolley", "WT-100", "$249.00", "In stock", "Published"],
  ["Safety Gloves", "PPE", "safety-gloves", "SG-240", "$12.50", "In stock", "Published"],
  ["Packing Tape", "Packaging", "packing-tape", "PT-500", "$6.20", "Low stock", "Published"]
];

const auditEvents = [
  ["Ticket created", "agent@csa.local", "Tickets", "CSA-1024", "8 min ago"],
  ["Order lookup", "agent@csa.local", "Orders", "ORD-54019", "18 min ago"],
  ["AI summary generated", "ai-assist", "CSA Assistant", "session-76", "26 min ago"]
];

function Toolbar({
  action,
  options,
  placeholder = "Search"
}: {
  action?: string;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-csa-border bg-white p-3 shadow-card">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex h-10 min-w-[190px] items-center justify-between rounded-control border border-csa-border bg-white px-3 text-[13px] font-semibold text-csa-navy">
          {options[0]}
          <ChevronDown size={14} className="text-csa-muted" />
        </div>
        <div className="flex h-10 min-w-[280px] flex-1 items-center gap-2 rounded-control border border-csa-border bg-white px-3">
          <Search size={15} className="text-csa-muted" />
          <span className="text-[13px] text-slate-400">{placeholder}</span>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-control border border-csa-border bg-white px-3 text-[13px] font-semibold text-csa-navy shadow-sm"
      >
        <SlidersHorizontal size={15} />
        Filters
      </button>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-control border border-csa-border bg-white px-3 text-[13px] font-semibold text-csa-navy shadow-sm"
      >
        <RefreshCcw size={15} />
        Refresh
      </button>
      {action ? (
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-control bg-primary-600 px-4 text-[13px] font-semibold text-white shadow-card transition hover:bg-primary-700"
        >
          <Plus size={15} />
          {action}
        </button>
      ) : null}
    </div>
  );
}

function StatusChip({ value }: { value: string }) {
  const lowered = value.toLowerCase();
  const tone = lowered.includes("high") || lowered.includes("review")
    ? "border-red-200 bg-red-50 text-red-700"
    : lowered.includes("normal") || lowered.includes("pending") || lowered.includes("waiting")
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {value}
    </span>
  );
}

function DataPanel({
  columns,
  rows,
  title
}: {
  columns: string[];
  rows: string[][];
  title: string;
}) {
  return (
    <section className="rounded-card border border-csa-border bg-white shadow-card">
      <div className="border-b border-csa-border px-5 py-4">
        <h2 className="text-[15px] font-bold text-csa-navy">{title}</h2>
      </div>
      <div className="overflow-auto">
        <div
          className="grid min-w-[980px] border-b border-csa-border bg-csa-surface-2 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-csa-muted"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(130px, 1fr))` }}
        >
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="divide-y divide-csa-border">
          {rows.map((row) => (
            <div
              className="grid min-w-[980px] px-5 py-4 text-[13px] font-medium text-csa-navy"
              key={row.join("-")}
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(130px, 1fr))` }}
            >
              {row.map((cell, index) => (
                <span className={index === 0 ? "font-bold" : "text-csa-muted"} key={`${cell}-${index}`}>
                  {index >= 3 && index <= 5 ? <StatusChip value={cell} /> : cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string, string]> }) {
  return (
    <section className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      {metrics.map(([label, value, helper]) => (
        <article className="rounded-card border border-csa-border bg-white p-5 shadow-card" key={label}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-csa-muted">{label}</p>
          <p className="mt-3 text-[28px] font-bold leading-none text-csa-navy">{value}</p>
          <p className="mt-2 text-[12px] font-medium text-csa-muted">{helper}</p>
        </article>
      ))}
    </section>
  );
}

export function TicketsPageView() {
  return (
    <>
      <PageHeader
        description="Manage cases with ticket number, source, status, priority, category, subject, and assignee controls."
        eyebrow="Ticket operations"
        title="Tickets"
      />
      <Toolbar action="Create ticket" options={["Ticket Number", "Customer Email", "Subject"]} placeholder="Search tickets" />
      <DataPanel
        columns={["Ticket Number", "Customer", "Source", "Status", "Priority", "Category", "Subject", "Assignee"]}
        rows={tickets}
        title="Ticket List"
      />
    </>
  );
}

export function CustomersPageView() {
  return (
    <>
      <PageHeader
        description="Search customer profiles by identifiers, names, company, email, group, and activity dates."
        eyebrow="Customer operations"
        title="Customers"
      />
      <Toolbar action="Create customer" options={["All fields", "Email", "First name", "Last name", "Company"]} placeholder="Search customers" />
      <DataPanel
        columns={["Customer Id", "First Name", "Last Name", "Company", "Email", "Customer Group", "Date Created"]}
        rows={customers}
        title="Customer List"
      />
    </>
  );
}

export function OrdersPageView() {
  return (
    <>
      <PageHeader
        description="Review order number, customer, totals, item counts, order state, payment state, and created dates."
        eyebrow="Order operations"
        title="Orders"
      />
      <Toolbar options={["All fields", "Customer email", "Order number", "SKU", "Order status"]} placeholder="Search orders" />
      <DataPanel
        columns={["Order Number", "Customer", "Customer Email", "Order Total", "Items", "Order Status", "Payment Status", "Created"]}
        rows={orders}
        title="Orders"
      />
    </>
  );
}

export function CartPageView() {
  return (
    <>
      <PageHeader
        description="Review active carts, cart ownership, item counts, totals, and checkout readiness."
        eyebrow="Cart operations"
        title="Carts"
      />
      <Toolbar options={["Cart ID", "Customer email"]} placeholder="Search carts" />
      <DataPanel
        columns={["Cart ID", "Order Number", "Customer", "Cart Total", "Items", "Cart Status", "Created", "Modified"]}
        rows={carts}
        title="Carts"
      />
    </>
  );
}

export function ProductsPageView() {
  return (
    <>
      <PageHeader
        description="Search catalog projections with product type, key, SKU, price, availability, and publication status."
        eyebrow="Product search"
        title="Products"
      />
      <Toolbar options={["Product name", "Product key", "SKU", "Product type"]} placeholder="Search products" />
      <DataPanel
        columns={["Product name", "Product type", "Product key", "SKU", "Price", "Availability", "Status"]}
        rows={products}
        title="Product List"
      />
    </>
  );
}

export function ReportsPageView() {
  const metrics: Array<[string, string, string]> = [
    ["Sessions", "214", "Selected period"],
    ["Messages", "1.8k", "AI and agent activity"],
    ["Tokens", "842k", "Gateway usage"],
    ["Cost", "$42.18", "Estimated"]
  ];

  return (
    <>
      <PageHeader
        actions={
          <button className="inline-flex h-10 items-center gap-2 rounded-control bg-primary-600 px-4 text-[13px] font-semibold text-white shadow-card" type="button">
            <Download size={15} />
            Export
          </button>
        }
        description="Export operational reports for tickets, orders, carts, customers, products, SLA, and AI usage."
        eyebrow="Analytics"
        title="Reports"
      />
      <div className="mb-5 flex flex-wrap gap-3 rounded-card border border-csa-border bg-white p-3 shadow-card">
        {["Tickets", "Orders", "Carts", "Customer", "Product", "SLA"].map((type) => (
          <button className="h-9 rounded-control border border-csa-border bg-white px-3 text-[12px] font-semibold text-csa-navy" key={type} type="button">
            {type}
          </button>
        ))}
      </div>
      <MetricGrid metrics={metrics} />
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-csa-border bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-bold text-csa-navy">Daily Usage</h2>
          <div className="mt-6 flex h-28 items-end gap-2">
            {[42, 64, 48, 88, 72, 96, 58, 112, 84, 76, 104, 68].map((height, index) => (
              <div className="flex flex-1 flex-col items-center gap-2" key={height + index}>
                <div className="w-full rounded-t bg-primary-600" style={{ height }} />
                <span className="text-[10px] font-medium text-csa-muted">{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <DataPanel
          columns={["Agent", "Messages", "Tokens", "Cost"]}
          rows={[
            ["agent@csa.local", "420", "128k", "$12.20"],
            ["ops@csa.local", "312", "88k", "$8.40"],
            ["admin@csa.local", "206", "61k", "$5.10"]
          ]}
          title="Top Agents"
        />
      </section>
    </>
  );
}

export function KnowledgeBasePageView() {
  const [tab, setTab] = useState<"FAQ" | "Troubleshoot">("FAQ");
  const items =
    tab === "FAQ"
      ? [
          ["What services do you offer?", "Multi-channel support, intelligent routing, analytics, automation, and omnichannel communication."],
          ["What payment methods are supported?", "Credit cards, debit cards, and configured alternative payment methods."],
          ["Can agents handle multiple tickets?", "Yes. The workspace supports parallel ticket handling with priority queues."]
        ]
      : [
          ["Customer not able to login", "Check URL, verify credentials, then trigger password reset."],
          ["How to add a discount code", "Open cart, add discount code, apply, and verify recalculated totals."],
          ["Payment failures", "Check gateway response, retry payment, or escalate to payment review."]
        ];

  return (
    <>
      <PageHeader
        description="Agent-facing FAQ and troubleshooting content with tabbed article groups."
        eyebrow="Knowledge"
        title="Knowledgebase"
      />
      <div className="rounded-card border border-csa-border bg-white p-5 shadow-card">
        <div className="mb-5 flex border-b border-csa-border">
          {(["FAQ", "Troubleshoot"] as const).map((item) => (
            <button
              className={[
                "mb-[-1px] px-6 py-3 text-[13px] font-semibold",
                tab === item
                  ? "border-b-2 border-primary-600 text-primary-700"
                  : "border-b-2 border-transparent text-csa-muted"
              ].join(" ")}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="max-w-4xl space-y-3">
          {items.map(([question, answer]) => (
            <details className="rounded-control border border-csa-border bg-white open:bg-primary-50" key={question}>
              <summary className="cursor-pointer px-5 py-4 text-[13px] font-semibold text-csa-navy">
                {question}
              </summary>
              <p className="border-t border-csa-border px-5 py-4 text-[13px] font-medium leading-6 text-csa-muted">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}

export function CsaAssistantPageView() {
  return (
    <>
      <PageHeader
        description="Three-pane assistant workspace for conversations, live chat, tool calls, and customer context."
        eyebrow="AI workspace"
        title="CSA Assistant"
      />
      <section className="grid h-[calc(100vh-180px)] min-h-[620px] gap-5 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="rounded-card border border-csa-border bg-white shadow-card">
          <div className="border-b border-csa-border px-4 py-3">
            <h2 className="text-[13px] font-bold text-csa-navy">Active conversations</h2>
          </div>
          {["Mia Johnson", "Rahul Mehta", "Sofia Garcia"].map((name, index) => (
            <button className="flex w-full items-start gap-3 border-b border-csa-border px-4 py-3 text-left" key={name} type="button">
              <MessageSquare size={15} className="mt-0.5 text-primary-600" />
              <span>
                <span className="block text-[13px] font-semibold text-csa-navy">{name}</span>
                <span className="text-[12px] font-medium text-csa-muted">{index === 0 ? "Delayed order" : "Customer context"}</span>
              </span>
            </button>
          ))}
        </aside>
        <div className="flex min-w-0 flex-col rounded-card border border-csa-border bg-white shadow-card">
          <div className="border-b border-csa-border px-5 py-4">
            <h2 className="text-[15px] font-bold text-csa-navy">Agent conversation</h2>
          </div>
          <div className="flex-1 space-y-4 overflow-auto p-5">
            <div className="max-w-[70%] rounded-card bg-csa-surface-2 p-4 text-[13px] font-medium text-csa-navy">
              Customer says their order has not moved since payment.
            </div>
            <div className="ml-auto max-w-[76%] rounded-card bg-primary-600 p-4 text-[13px] font-medium text-white">
              I found the order, payment is captured, and fulfillment is waiting for inventory allocation.
            </div>
          </div>
          <div className="border-t border-csa-border p-4">
            <div className="flex items-center gap-3 rounded-control border border-csa-border bg-white px-3 py-2">
              <span className="flex-1 text-[13px] text-slate-400">Ask CSA Assistant...</span>
              <button className="grid h-8 w-8 place-items-center rounded-full bg-primary-600 text-white" type="button">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
        <aside className="rounded-card border border-csa-border bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-bold text-csa-navy">Context</h2>
          <div className="mt-4 space-y-3">
            {["Customer profile", "Open tickets", "Recent orders", "Cart state", "Knowledge matches"].map((item) => (
              <div className="rounded-control border border-csa-border bg-csa-surface-2 px-3 py-2.5 text-[12px] font-semibold text-csa-navy" key={item}>
                {item}
              </div>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}

export function AuditLogPageView() {
  return (
    <>
      <PageHeader
        description="Review agent actions, AI tool activity, commerce operations, and security-sensitive changes."
        eyebrow="Administration"
        title="Audit Log"
      />
      <Toolbar action="Export audit" options={["All modules", "Tickets", "Orders", "CSA Assistant"]} placeholder="Search audit events" />
      <DataPanel
        columns={["Action", "Actor", "Module", "Entity", "Time"]}
        rows={auditEvents}
        title="Audit Events"
      />
    </>
  );
}
