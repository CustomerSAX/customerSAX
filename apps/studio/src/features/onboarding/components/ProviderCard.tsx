"use client";

import type { ReactNode } from "react";
import { Badge, Icon } from "@csa/ui";
import { getProviderLogo } from "./ProviderLogo";

interface ProviderCardProps {
  id: string;
  selected: boolean;
  onClick: () => void;
  title: string;
  badge?: string;
  badgeTone?: "primary" | "success" | "neutral" | "warning";
  description: string;
  icon?: string;
  logo?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
}

export function ProviderCard({
  id,
  selected,
  onClick,
  title,
  badge,
  badgeTone = "primary",
  description,
  icon,
  logo,
  children,
  footer,
  disabled = false
}: ProviderCardProps) {
  const resolvedLogo = logo !== undefined ? logo : getProviderLogo(id);
  return (
    <div
      onClick={() => {
        if (!disabled) onClick();
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex flex-col justify-between rounded-m-xl border p-5 text-left transition-all ${
        disabled
          ? "cursor-not-allowed opacity-50 bg-m-surface-subtle border-m-border"
          : selected
            ? "cursor-pointer border-m-primary bg-m-primary-50/40 ring-2 ring-m-primary/20 shadow-m-card"
            : "cursor-pointer border-m-border bg-m-surface hover:border-m-primary/60 hover:shadow-m-card"
      }`}
    >
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {resolvedLogo ? (
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-m-lg border transition-all mt-0.5 p-1.5 ${
                    selected
                      ? "border-m-primary/50 bg-white ring-2 ring-m-primary/20 shadow-xs"
                      : "border-m-border/80 bg-white group-hover:border-m-primary/40 group-hover:shadow-xs"
                  }`}
                >
                  {resolvedLogo}
                </div>
              ) : icon ? (
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-m-lg transition-colors mt-0.5 ${
                    selected
                      ? "bg-m-primary text-white"
                      : "bg-m-neutral-100 text-m-text group-hover:bg-m-primary-50 group-hover:text-m-primary"
                  }`}
                >
                  <Icon name={icon} size="sm" />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-m-text tracking-tight">{title}</span>
                  {badge && (
                    <Badge
                      variant={badgeTone === "success" ? "success" : "neutral"}
                      appearance="subtle"
                      size="sm"
                      className="font-medium text-[10px] shrink-0"
                    >
                      {badge}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all mt-0.5 ${
                selected
                  ? "border-m-primary bg-m-primary text-white"
                  : "border-m-border bg-m-surface group-hover:border-m-primary/60"
              }`}
            >
              {selected && (
                <span className="h-2 w-2 rounded-full bg-white" />
              )}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-m-text-muted">{description}</p>
        </div>

        {children && <div className="mt-4 pt-3 border-t border-m-border/60">{children}</div>}
      </div>

      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
