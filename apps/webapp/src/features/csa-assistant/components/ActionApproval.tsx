"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";
import type { ActionApprovalArgs } from "../types";

const INTENT_ICON: Record<string, string> = {
  cancel_order: "x-circle",
  place_order: "shopping-cart",
  start_return: "rotate-ccw",
  process_refund: "credit-card",
  update_order: "edit",
  other: "alert-triangle"
};

const INTENT_CLASS: Record<string, string> = {
  cancel_order: "border-l-m-error",
  place_order: "border-l-m-primary",
  start_return: "border-l-m-warning",
  process_refund: "border-l-m-info",
  update_order: "border-l-m-warning",
  other: "border-l-m-border"
};

interface ActionApprovalProps {
  args: ActionApprovalArgs;
  onApprove: (executeCommand: string) => void;
  onDecline: () => void;
  isPending?: boolean;
}

export function ActionApproval({ args, onApprove, onDecline, isPending }: ActionApprovalProps) {
  const iconName = INTENT_ICON[args.intent] ?? "alert-triangle";
  const borderClass = INTENT_CLASS[args.intent] ?? "border-l-m-border";

  return (
    <Card variant="default" className={`my-2 border-l-4 ${borderClass} max-w-md`}>
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon name={iconName as "x-circle"} size="sm" className="text-m-text-muted" />
          <CardTitle className="text-sm font-semibold">{args.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-m-text leading-relaxed">{args.description}</p>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onApprove(args.executeCommand)}
            disabled={isPending}
            leftIcon={<Icon name="check" size="xs" />}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={onDecline}
            disabled={isPending}
            leftIcon={<Icon name="x" size="xs" />}
          >
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
