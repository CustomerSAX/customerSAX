import { Badge, PageHeader } from "@csa/ui";
import { ReportExportPanel } from "./ReportExportPanel";

export function ReportsView() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Insights"
        subtitle="Monitor system usage, AI assistant metrics, and export customized Excel reports."
        badge={
          <Badge variant="primary" appearance="subtle">
            Operational Exports & Analytics
          </Badge>
        }
      />
      <ReportExportPanel />
    </div>
  );
}
