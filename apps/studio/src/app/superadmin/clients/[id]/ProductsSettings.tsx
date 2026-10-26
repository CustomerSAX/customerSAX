"use client";
import Link from "next/link";
import type { ProjectRow } from "./types";
export function ProductsSettings({
  project
}: {
  clientId: string;
  project: ProjectRow;
  onSaved?: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-m-border p-4">
      <p>
        External product search for {project.projectKey} is managed in Connection Hub.
        Commerce platform credentials remain in project configuration.
      </p>
      <Link href="/admin-settings/connection-hub" className="text-m-primary">
        Open Connection Hub
      </Link>
    </div>
  );
}
