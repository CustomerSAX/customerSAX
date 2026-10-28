"use client";

import Link from "next/link";
import { Icon } from "@csa/ui";
import { AppShell } from "@/components/shell/AppShell";
import { useCurrentUser } from "@/lib/use-current-user";
import { NativeConnectorsGrid } from "./NativeConnectorsGrid";
import { NativeSlaTargetsCard } from "./NativeSlaTargetsCard";

export function StudioConnectorsView({ embedded }: { embedded?: boolean } = {}) {
  const { user, loading } = useCurrentUser();
  const allowed = user?.role === "admin" || user?.role === "superadmin";
  const content = (
    <section
      aria-label="Native connectors"
      className={embedded ? "space-y-5" : "space-y-5 p-6"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-m-text">Native Connectors</h2>
          <p className="mt-1 max-w-2xl text-sm text-m-text-muted">
            Built-in platform capabilities. Browse and configure external connectors in
            Connection Hub.
          </p>
        </div>
        {allowed && (
          <Link
            href="/admin-settings/connection-hub"
            className="inline-flex items-center gap-2 rounded-lg border border-m-border bg-m-surface px-4 py-2 text-sm font-medium text-m-primary"
          >
            <Icon name="link" size="xs" />
            Open Connection Hub
          </Link>
        )}
      </div>
      {loading ? (
        <p role="status" className="text-sm text-m-text-muted">
          Loading native capabilities…
        </p>
      ) : !allowed ? (
        <p>Administrator access is required.</p>
      ) : (
        <>
          <NativeConnectorsGrid />
          <NativeSlaTargetsCard />
        </>
      )}
    </section>
  );
  return embedded ? content : <AppShell>{content}</AppShell>;
}
