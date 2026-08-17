"use client";

import { Badge, PageHeader } from "@csa/ui";
import { KnowledgeBasePanel } from "./KnowledgeBasePanel";

export function KnowledgeBaseView() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledgebase"
        subtitle="Search agent standard operating procedures, policies, and troubleshooting guides."
        badge={
          <Badge variant="primary" appearance="subtle">
            Agent Resources & Documentation
          </Badge>
        }
      />
      <KnowledgeBasePanel />
    </div>
  );
}
