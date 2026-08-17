"use client";

import { Button } from "@csa/ui";
import type { SuggestedActionsArgs } from "../types";

interface SuggestedActionsProps {
  args: SuggestedActionsArgs;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestedActions({ args, onSelect, disabled }: SuggestedActionsProps) {
  if (!args.actions?.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {args.actions.map((action, i) => (
        <Button
          key={i}
          variant="ghost"
          size="sm"
          className="text-xs border border-m-border hover:bg-m-surface-2 hover:border-m-primary hover:text-m-primary rounded-full px-3"
          onClick={() => onSelect(action.prompt)}
          disabled={disabled}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
