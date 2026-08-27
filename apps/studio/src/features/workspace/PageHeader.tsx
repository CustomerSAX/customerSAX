import type { ReactNode } from "react";
import { PageHeader as MeridianPageHeader, Badge } from "@csa/ui";

export function PageHeader({
  actions,
  eyebrow,
  title,
  description
}: {
  actions?: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <MeridianPageHeader
        title={title}
        subtitle={description}
        badge={
          <Badge variant="primary" size="sm">
            {eyebrow}
          </Badge>
        }
        actions={actions}
      />
    </div>
  );
}
