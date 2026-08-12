import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ImportExportView } from "@/features/import-export/components/ImportExportView";

export default function ImportExportPage() {
  return (
    <AppShell>
      <Suspense fallback={<div>Loading import/export tools...</div>}>
        <ImportExportView />
      </Suspense>
    </AppShell>
  );
}
