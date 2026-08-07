"use client";

import { useQuery } from "@apollo/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardMetric,
  Badge,
  Icon,
  LoadingSpinner
} from "@csa/ui";
import { AppShell } from "../../components/shell/AppShell";
import { GATEWAY_STATUS_QUERY } from "./api/queries";
import { PageHeader } from "../workspace/PageHeader";

type GatewayStatusData = {
  hello?: string;
  serviceMap?: Array<{ name: string; status: string }>;
};

const fallbackGateway = {
  message: "Connected to GraphQL BFF",
  services: [
    { name: "Experience BFF", status: "online" },
    { name: "Commerce Connector", status: "online" },
    { name: "AI Assist Gateway", status: "online" }
  ]
};

const kpis = [
  { label: "Open Tickets", value: "128", helper: "24 high priority", trend: { value: "12%", direction: "up" as const } },
  { label: "SLA At-Risk", value: "18", helper: "Needs attention", trend: { value: "4 cases", direction: "down" as const } },
  { label: "Orders Reviewed", value: "342", helper: "Today", trend: { value: "18%", direction: "up" as const } },
  { label: "AI Assist Resolved", value: "76", helper: "Context-aware", trend: { value: "95% accuracy", direction: "up" as const } }
];

const queue = [
  {
    id: "CSA-1024",
    customer: "Mia Johnson",
    subject: "Order delayed after payment capture",
    status: "High",
    time: "8 min ago"
  },
  {
    id: "CSA-1025",
    customer: "Rahul Mehta",
    subject: "Cart discount code not applied",
    status: "Normal",
    time: "21 min ago"
  },
  {
    id: "CSA-1026",
    customer: "Sofia Garcia",
    subject: "Product availability confirmation",
    status: "Low",
    time: "43 min ago"
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
          <Card className="px-4 py-2 flex items-center gap-3">
            <Icon name="activity" className="text-m-primary" size="sm" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-m-text-muted">BFF Gateway</span>
              <span className="text-xs font-semibold text-m-text">
                {loading ? <LoadingSpinner size="xs" label="Connecting..." /> : gateway.message}
              </span>
            </div>
          </Card>
        }
        description="Enterprise GCP-ready support console with Next.js, GraphQL BFF, commerce connectors, and Meridian design system."
        eyebrow="Dashboard"
        title="Customer Service Accelerator"
      />

      {/* KPI Cards */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <CardMetric
            key={kpi.label}
            title={kpi.label}
            value={kpi.value}
            subtitle={kpi.helper}
            trend={kpi.trend}
          />
        ))}
      </section>

      {/* Main Grid Section */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Active Queue Card */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Active Work Queue</CardTitle>
            <CardDescription>
              Real-time ticket requests, customer context, and commerce activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-m-border/60">
            {queue.map((item) => (
              <div
                className="flex items-center justify-between gap-4 p-4 hover:bg-m-surface-2/40 transition-colors"
                key={item.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-m-primary">{item.id}</span>
                    <span className="text-xs font-semibold text-m-text truncate">{item.subject}</span>
                  </div>
                  <p className="text-xs text-m-text-muted">{item.customer}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge
                    variant={item.status === "High" ? "error" : item.status === "Normal" ? "warning" : "success"}
                    size="sm"
                    dot
                  >
                    {item.status} Priority
                  </Badge>
                  <span className="text-[11px] font-medium text-m-text-muted">{item.time}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sidebar Cards */}
        <aside className="space-y-6">
          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Icon name="sparkles" className="text-m-primary" size="sm" />
                <CardTitle>CSA Assistant</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-m-text-muted leading-relaxed">
                AI Agent is active with Vercel AI Gateway support. Access models across OpenAI, Claude, or Grok with custom tools.
              </p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <CardTitle>Core Service Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {gateway.services.map((service) => (
                <div
                  className="flex items-center justify-between rounded-m-md border border-m-border bg-m-surface-2 p-3"
                  key={service.name}
                >
                  <span className="text-xs font-medium text-m-text">{service.name}</span>
                  <Badge
                    variant={service.status.includes("online") ? "success" : "neutral"}
                    size="sm"
                    dot
                  >
                    {service.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>
    </AppShell>
  );
}
