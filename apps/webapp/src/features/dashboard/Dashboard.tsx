"use client";

import { useQuery } from "@apollo/client";
import { StatusCard } from "@csa/ui";
import { GATEWAY_STATUS_QUERY } from "../../graphql/queries";

const modules = [
  "Dashboard",
  "Tickets",
  "Customers",
  "Orders",
  "Carts",
  "Products",
  "Reports",
  "Knowledge Base",
  "CSA Assistant",
  "Audit Log"
];

type GatewayStatusData = {
  hello?: string;
  serviceMap?: Array<{ name: string; status: string }>;
};

const fallbackGateway = {
  message: "Hello from the CSA frontend",
  services: [
    { name: "Experience BFF", status: "offline locally" },
    { name: "AI Assist", status: "offline locally" }
  ]
};

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
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">CSA GCP Environment</p>
          <h1>Customer Service Accelerator</h1>
          <p className="lede">
            Hello world for a GCP-ready support console with a Next.js frontend,
            Node.js GraphQL gateway, AI assist service, and Terraform foundation.
          </p>
        </div>
        <StatusCard
          title="Gateway"
          value={loading ? "Connecting to the CSA GraphQL BFF" : gateway.message}
          tone="purple"
        />
      </section>

      <section className="moduleGrid" aria-label="CSA modules">
        {modules.map((module) => (
          <div className="module" key={module}>
            {module}
          </div>
        ))}
      </section>

      <section className="services">
        <h2>Core Service Map</h2>
        <div className="serviceGrid">
          {gateway.services.map((service) => (
            <StatusCard
              key={service.name}
              title={service.name}
              value={service.status}
              tone={service.status.includes("online") ? "green" : "blue"}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

