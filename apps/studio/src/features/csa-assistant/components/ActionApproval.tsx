"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FormField, Icon, Input, Label, Select, TextArea } from "@csa/ui";
import type { ActionApprovalArgs, ApprovalField, ApprovalResolution } from "../types";

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

const RESOLUTION_BADGE: Record<Exclude<ApprovalResolution, null>, { label: string; variant: "success" | "neutral" }> = {
  approved: { label: "Approved", variant: "success" },
  declined: { label: "Declined", variant: "neutral" },
  superseded: { label: "No longer pending", variant: "neutral" }
};

interface ActionApprovalProps {
  args: ActionApprovalArgs;
  onApprove: (executeCommand: string) => void;
  onDecline: () => void;
  isPending?: boolean;
  /** Set once the rep has answered this card (or moved on); the buttons are then replaced by the outcome. */
  resolution?: ApprovalResolution;
  /** True for the newest unanswered card: it takes focus so Enter approves and Esc declines. */
  autoFocus?: boolean;
}

// A select's pre-fill must be one of its option values; the model sometimes
// sends the label instead ("Customer Request" for "customer_request").
function initialValue(f: ApprovalField) {
  const value = f.value ?? "";
  if (f.type !== "select" || !f.options?.length || !value) return value;
  const match = f.options.find((o) => o.value === value || o.label.toLowerCase() === value.toLowerCase());
  return match?.value ?? "";
}

function initialValues(fields: ApprovalField[] | undefined) {
  return Object.fromEntries((fields ?? []).map((f) => [f.key, initialValue(f)]));
}

export function ActionApproval({ args, onApprove, onDecline, isPending, resolution = null, autoFocus }: ActionApprovalProps) {
  const iconName = INTENT_ICON[args.intent] ?? "alert-triangle";
  const borderClass = INTENT_CLASS[args.intent] ?? "border-l-m-border";
  const fields = args.fields ?? [];
  const steps = args.steps ?? [];
  const changes = args.changes ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(args.fields));
  const approveRef = useRef<HTMLButtonElement>(null);
  const open = resolution === null;

  useEffect(() => {
    if (open && autoFocus) approveRef.current?.focus();
  }, [open, autoFocus]);

  const missing = fields.some((f) => f.required && !values[f.key]?.trim());
  const edited = fields.filter((f) => (values[f.key] ?? "") !== initialValue(f));

  function approve() {
    if (!open || isPending || missing) return;
    // Every field value travels with the approval, so the assistant executes
    // exactly what the rep saw (and possibly adjusted) on this card.
    const command = fields.length
      ? `${args.executeCommand}\nValues: ${JSON.stringify(values)}${edited.length ? `\nEdited by rep: ${edited.map((f) => f.key).join(", ")}` : ""}`
      : args.executeCommand;
    onApprove(command);
  }

  return (
    <Card
      variant="default"
      className={`my-2 border-l-4 ${borderClass} max-w-md ${open ? "" : "opacity-80"}`}
      onKeyDown={(e) => {
        if (!open || isPending) return;
        if (e.key === "Escape") {
          e.preventDefault();
          onDecline();
        } else if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          approve();
        }
      }}
    >
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name={iconName as "x-circle"} size="sm" className="text-m-text-muted" />
            <CardTitle className="text-sm font-semibold">{args.title}</CardTitle>
          </div>
          {!open && resolution && (
            <Badge variant={RESOLUTION_BADGE[resolution].variant} size="sm">
              {RESOLUTION_BADGE[resolution].label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-m-text leading-relaxed">{args.description}</p>

        {changes.length > 0 && (
          <div className="rounded-m-md border border-m-border divide-y divide-m-border">
            {changes.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                <span className="text-m-text-muted">{c.label}</span>
                <span className="text-right font-medium text-m-text">
                  {c.from != null && c.from !== "" && (
                    <>
                      <span className="text-m-text-muted line-through">{c.from}</span>
                      <span className="mx-1.5 text-m-text-muted">→</span>
                    </>
                  )}
                  {c.to}
                </span>
              </div>
            ))}
          </div>
        )}

        {steps.length > 1 && (
          <ol className="space-y-1 text-xs text-m-text">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-m-surface-2 text-[10px] font-semibold text-m-text-muted">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        {fields.length > 0 && (
          <div className="space-y-2">
            {fields.map((f) => {
              const value = values[f.key] ?? "";
              const set = (v: string) => setValues((prev) => ({ ...prev, [f.key]: v }));
              const disabled = !open || isPending;
              return (
                <FormField key={f.key}>
                  <Label required={f.required}>{f.label}</Label>
                  {f.type === "select" && f.options?.length ? (
                    <Select
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      disabled={disabled}
                      // Nothing is pre-chosen for the rep unless the assistant had a real basis for it.
                      options={value ? f.options : [{ value: "", label: "Choose…" }, ...f.options]}
                    />
                  ) : f.type === "textarea" ? (
                    <TextArea value={value} onChange={(e) => set(e.target.value)} disabled={disabled} rows={3} />
                  ) : (
                    <Input type={f.type === "date" ? "date" : "text"} value={value} onChange={(e) => set(e.target.value)} disabled={disabled} />
                  )}
                </FormField>
              );
            })}
          </div>
        )}

        {open && (
          <>
            <div className="flex gap-2">
              <Button
                ref={approveRef}
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={approve}
                disabled={isPending || missing}
                leftIcon={<Icon name="check" size="xs" />}
              >
                {steps.length > 1 ? `Approve all (${steps.length})` : "Approve"}
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
            <p className="text-[10px] text-m-text-muted">Enter to approve · Esc to decline</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
