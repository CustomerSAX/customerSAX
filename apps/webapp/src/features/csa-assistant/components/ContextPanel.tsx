"use client";

import { useMemo } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";
import type { UIMessage } from "ai";
import type { CaseBriefingArgs, UpdateUiStateArgs } from "../types";

interface ContextPanelProps {
  messages: UIMessage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastToolArgs<T>(
  messages: UIMessage[],
  toolName: string
): T | null {
  // In ai@6+, ToolUIPart has type `tool-${name}` and the invocation fields are directly on the part.
  // DynamicToolUIPart has type 'dynamic-tool' and an explicit toolName field.
  const staticType = `tool-${toolName}`;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    for (const part of msg.parts ?? []) {
      const p = part as { type: string; toolName?: string; state?: string; input?: unknown };
      const isMatch =
        p.type === staticType ||
        (p.type === "dynamic-tool" && p.toolName === toolName);
      if (isMatch && (p.state === "output-available" || p.state === "input-available")) {
        return p.input as T;
      }
    }
  }
  return null;
}

const STAGE_LABEL: Record<string, string> = {
  greeting: "Greeting",
  identifying_customer: "Identifying Customer",
  reading_order: "Reading Order",
  reading_ticket: "Reading Ticket",
  reading_cart: "Reading Cart",
  reading_product: "Browsing Products",
  composing_action: "Composing Action",
  awaiting_approval: "Awaiting Approval",
  executing_action: "Executing Action",
  summarizing: "Summarizing",
  drafting_email: "Drafting Email",
  knowledge_lookup: "Knowledge Lookup",
  closing: "Closing"
};

const SENTIMENT_VARIANT: Record<string, "neutral" | "success" | "warning" | "error"> = {
  positive: "success",
  resolved: "success",
  neutral: "neutral",
  concerned: "warning",
  frustrated: "error"
};

// ─── UI State panel ───────────────────────────────────────────────────────────

function UiStatePanel({ state }: { state: UpdateUiStateArgs }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-m-text-muted">Stage</span>
        <Badge variant="info" size="sm">
          {STAGE_LABEL[state.workflowStage] ?? state.workflowStage}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-m-text-muted">Sentiment</span>
        <Badge variant={SENTIMENT_VARIANT[state.sentiment] ?? "neutral"} size="sm">
          {state.sentiment}
        </Badge>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-m-text-muted">Confidence</span>
          <span className="text-xs font-semibold text-m-text">{state.confidence}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-m-surface-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-m-primary transition-all duration-500"
            style={{ width: `${state.confidence}%` }}
          />
        </div>
      </div>
      {state.goal && (
        <div>
          <p className="text-xs text-m-text-muted mb-0.5">Goal</p>
          <p className="text-xs text-m-text">{state.goal}</p>
        </div>
      )}
      {state.strategy && (
        <div>
          <p className="text-xs text-m-text-muted mb-0.5">Strategy</p>
          <p className="text-xs text-m-text italic">{state.strategy}</p>
        </div>
      )}
      {state.nextSteps?.length > 0 && (
        <div>
          <p className="text-xs text-m-text-muted mb-1">Next Steps</p>
          <ul className="space-y-0.5">
            {state.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-m-text">
                <span className="text-m-primary mt-0.5 flex-shrink-0">›</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Case briefing mini panel ─────────────────────────────────────────────────

function CaseBriefingMini({ args }: { args: CaseBriefingArgs }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-m-text">{args.customerName}</span>
        <Badge variant={SENTIMENT_VARIANT[args.sentiment] ?? "neutral"} size="sm">
          {args.sentiment}
        </Badge>
      </div>
      {args.ticketNumber && (
        <p className="text-xs text-m-text-muted">Ticket {args.ticketNumber}</p>
      )}
      <div>
        <p className="text-xs font-medium text-m-text-muted mb-0.5">{args.issueCategory}</p>
        <p className="text-xs text-m-text">{args.caseSummary}</p>
      </div>
      <div>
        <p className="text-xs text-m-text-muted mb-0.5">Recommended</p>
        <p className="text-xs text-m-text">{args.recommendedResolution}</p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyContext() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-m-surface-3 flex items-center justify-center mb-3">
        <Icon name="layers" size="md" className="text-m-text-muted" />
      </div>
      <p className="text-xs text-m-text-muted">
        Context cards will appear here as you use the assistant.
      </p>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ContextPanel({ messages }: ContextPanelProps) {
  const uiState = useMemo(
    () => getLastToolArgs<UpdateUiStateArgs>(messages, "update_ui_state"),
    [messages]
  );

  const caseBriefing = useMemo(
    () => getLastToolArgs<CaseBriefingArgs>(messages, "case_briefing_card"),
    [messages]
  );

  const hasContent = uiState || caseBriefing;

  return (
    <Card variant="default" className="flex flex-col h-full">
      <CardHeader className="px-4 py-3 border-b border-m-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon name="layout-panel-right" size="sm" className="text-m-text-muted" />
          <CardTitle className="text-xs font-semibold text-m-text-muted uppercase tracking-wide">
            Intelligence
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasContent && <EmptyContext />}

        {/* AI workflow intelligence */}
        {uiState && (
          <section>
            <h3 className="text-[10px] font-semibold text-m-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Icon name="cpu" size="xs" />
              AI Status
            </h3>
            <UiStatePanel state={uiState} />
          </section>
        )}

        {/* Case briefing */}
        {caseBriefing && (
          <section className="pt-3 border-t border-m-border">
            <h3 className="text-[10px] font-semibold text-m-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Icon name="file-text" size="xs" />
              Case Briefing
            </h3>
            <CaseBriefingMini args={caseBriefing} />
          </section>
        )}

        {/* Customer ID quick view */}
        {uiState?.customerId && (
          <section className="pt-3 border-t border-m-border">
            <h3 className="text-[10px] font-semibold text-m-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Icon name="user" size="xs" />
              Active Customer
            </h3>
            <p className="text-xs font-mono text-m-text bg-m-surface-2 rounded-m-sm px-2 py-1">
              {uiState.customerId}
            </p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
