"use client";

import { Badge, Card, Icon } from "@csa/ui";
import { NATIVE_CONNECTOR_CATEGORIES } from "@/features/onboarding/connectors.config";
import type { OnboardingState } from "@/features/onboarding/types";

export function NativeConnectorsGrid({ state }: { state?: OnboardingState }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {NATIVE_CONNECTOR_CATEGORIES.map((category) => (
        <Card
          key={category.id}
          className="min-w-0 space-y-3 border border-m-border bg-m-surface p-5 shadow-m-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-m-border bg-m-surface-subtle">
              <Icon name={category.nativeIntegration.icon} size="sm" />
            </div>
            <Badge variant="neutral" size="sm">
              {state && category.nativeIntegration.isActive(state)
                ? "Default"
                : "Built in"}
            </Badge>
          </div>
          <div>
            <p className="mb-1 text-xs text-m-text-muted">{category.name}</p>
            <h3 className="font-semibold text-m-text">
              {category.nativeIntegration.name}
            </h3>
          </div>
          <p className="text-sm text-m-text-muted">
            {category.nativeIntegration.description}
          </p>
        </Card>
      ))}
    </div>
  );
}
