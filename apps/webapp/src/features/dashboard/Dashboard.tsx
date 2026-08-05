"use client";

import { useQuery } from "@apollo/client";
import { StatusCard } from "@csa/ui";
import { Sparkles } from "lucide-react";
import { AppShell } from "../../components/shell/AppShell";
import { GATEWAY_STATUS_QUERY } from "../../graphql/queries";
import { PageHeader } from "../workspace/PageHeader";

type GatewayStatusData = {
  hello?: string;
  serviceMap?: Array<{ name: string; status: string }>;
};

const fallbackGateway = {
  message: "Hello from the CSA frontend",
  services: [
    { name: "Experience BFF", status: "offline locally" },
    { name: "Commerce Connector", status: "offline locally" },
    { name: "AI Assist", status: "offline locally" }
  ]
};

const kpis = [
  { label: "Open tickets", value: "128", helper: "24 high priority", tone: "blue" as const },
  { label: "SLA risk", value: "18", helper: "Needs attention", tone: "purple" as const },
  { label: "Orders reviewed", value: "342", helper: "Today", tone: "green" as const },
  { label: "AI assists", value: "76", helper: "Resolved with context", tone: "blue" as const }
];

const queue = [
  {
    customer: "Mia Johnson",
    subject: "Order delayed after payment capture",
    status: "High",
    time: "8 min"
  },
  {
    customer: "Rahul Mehta",
    subject: "Cart discount not applied",
    status: "Normal",
    time: "21 min"
  },
  {
    customer: "Sofia Garcia",
    subject: "Product availability confirmation",
    status: "Low",
    time: "43 min"
  }
];

export function Dashboard() {
  const { data, error, loading } = useQuery<GatewayStatusData>(GATEWAY_STATUS_QUERY);
  const gateway =
    error || !data
      ? fallbackGateway
      : {
          message: data.hello ?? fallbackGateway.message,
          services: data.serviceMap ?? fallbackGateway.services
        };

  return (
    <AppShell>
      <PageHeader
        actions={
          <StatusCard
            title="Gateway"
            value={loading ? "Connecting to the CSA GraphQL BFF" : gateway.message}
            tone="purple"
          />
        }
        description="GCP-ready support console with a Next.js webapp, Apollo GraphQL BFF, commerce connectors, AI Assist, and Terraform foundation."
        eyebrow="Dashboard"
        title="Customer Service Accelerator"
      />

      <section className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {kpis.map((kpi) => (
          <StatusCard
            key={kpi.label}
            title={kpi.label}
            value={`${kpi.value} - ${kpi.helper}`}
            tone={kpi.tone}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-card border border-csa-border bg-white shadow-card">
          <div className="border-b border-csa-border px-5 py-4">
            <h2 className="text-[15px] font-bold text-csa-navy">Active Work Queue</h2>
            <p className="mt-1 text-[12px] font-medium text-csa-muted">
              Tickets, customer context, and commerce activity in one workspace.
            </p>
          </div>
          <div className="divide-y divide-csa-border">
            {queue.map((item) => (
              <div
                className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto]"
                key={item.subject}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-csa-navy">{item.subject}</p>
                  <p className="mt-1 text-[12px] font-medium text-csa-muted">{item.customer}</p>
                </div>
                <span
                  className={[
                    "inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold",
                    item.status === "High"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : item.status === "Normal"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  ].join(" ")}
                >
                  {item.status}
                </span>
                <span className="text-[12px] font-semibold text-csa-muted">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-card border border-csa-border bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-primary-600" />
              <h2 className="text-[15px] font-bold text-csa-navy">CSA Assistant</h2>
            </div>
            <p className="text-[13px] font-medium leading-6 text-csa-muted">
              AI service is wired for Vercel AI Gateway and can use OpenAI, Claude, or
              Grok by provider selection.
            </p>
          </div>

          <div className="rounded-card border border-csa-border bg-white p-5 shadow-card">
            <h2 className="mb-4 text-[15px] font-bold text-csa-navy">Core Service Map</h2>
            <div className="space-y-3">
              {gateway.services.map((service) => (
                <div
                  className="flex items-center justify-between rounded-control border border-csa-border bg-csa-surface-2 px-3 py-2.5"
                  key={service.name}
                >
                  <span className="text-[12px] font-semibold text-csa-navy">{service.name}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
                      service.status.includes("online")
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-primary-50 text-primary-700"
                    ].join(" ")}
                  >
                    {service.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
