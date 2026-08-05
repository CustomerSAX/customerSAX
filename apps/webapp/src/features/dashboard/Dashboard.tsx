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
    <main className="min-h-screen p-5 text-[#102044] md:p-10">
      <section className="grid items-center gap-8 rounded-lg border border-[#d8e0f0] bg-white p-6 md:grid-cols-[minmax(0,1fr)_320px] md:p-8">
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase text-[#7657f5]">
            CSA GCP Environment
          </p>
          <h1 className="mb-5 text-5xl font-bold leading-none md:text-7xl">
            Customer Service Accelerator
          </h1>
          <p className="m-0 max-w-3xl text-lg leading-7 text-[#45536f]">
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

      <section
        className="my-6 grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3"
        aria-label="CSA modules"
      >
        {modules.map((module) => (
          <div
            className="flex min-h-20 items-center justify-center rounded-lg border border-[#d8e0f0] bg-white p-4 text-center font-bold"
            key={module}
          >
            {module}
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-[#d8e0f0] bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Core Service Map</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
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
