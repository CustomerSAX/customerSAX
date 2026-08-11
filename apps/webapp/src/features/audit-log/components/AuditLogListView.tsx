"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Icon,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@csa/ui";
import {
  ACTION_BADGE_VARIANT,
  DATE_RANGE_OPTIONS,
  formatTimestamp,
  generateAuditLogEntries,
  isWithinDateRange,
} from "../hooks/use-audit-log";
import type { AuditDateRangeKey } from "../types/audit-log-types";

const LOADING_FLASH_MS = 250;
const COLUMN_COUNT = 7;

export function AuditLogListView() {
  const entries = useMemo(() => generateAuditLogEntries(), []);

  const [dateRange, setDateRange] = useState<AuditDateRangeKey>("last7");
  const [agent, setAgent] = useState("all");
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  const agentOptions = useMemo(() => {
    const unique = Array.from(new Set(entries.map((item) => item.agent))).sort();
    return [{ value: "all", label: "All agents" }, ...unique.map((name) => ({ value: name, label: name }))];
  }, [entries]);

  const actionOptions = useMemo(() => {
    const unique = Array.from(new Set(entries.map((item) => item.action))).sort();
    return [{ value: "all", label: "All action types" }, ...unique.map((name) => ({ value: name, label: name }))];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!isWithinDateRange(entry.timestamp, dateRange)) return false;
      if (agent !== "all" && entry.agent !== agent) return false;
      if (action !== "all" && entry.action !== action) return false;
      if (query) {
        const haystack = [entry.agent, entry.userEmail, entry.details, entry.entity, entry.module, entry.result]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [entries, dateRange, agent, action, search]);

  const flashLoading = () => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), LOADING_FLASH_MS);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <Card variant="default" className="flex flex-wrap items-center gap-3 p-4">
        <div className="w-40">
          <Select
            value={dateRange}
            onChange={(event) => {
              setDateRange(event.target.value as AuditDateRangeKey);
              flashLoading();
            }}
            options={DATE_RANGE_OPTIONS}
          />
        </div>
        <div className="w-44">
          <Select
            value={agent}
            onChange={(event) => {
              setAgent(event.target.value);
              flashLoading();
            }}
            options={agentOptions}
          />
        </div>
        <div className="w-48">
          <Select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              flashLoading();
            }}
            options={actionOptions}
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="relative flex items-center">
            <Icon name="search" size="xs" className="pointer-events-none absolute left-3 text-m-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                flashLoading();
              }}
              placeholder="Search by order, ticket, or customer..."
              className="h-[38px] w-full rounded-m-lg border border-m-border bg-m-surface pl-9 pr-3 text-xs outline-none transition-colors focus:border-m-primary focus:ring-2 focus:ring-m-primary/20"
            />
          </div>
        </div>
      </Card>

      <Card variant="default" className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                <TableHead className="whitespace-nowrap">Agent</TableHead>
                <TableHead className="whitespace-nowrap">Action</TableHead>
                <TableHead className="whitespace-nowrap">Area</TableHead>
                <TableHead className="whitespace-nowrap">Entity</TableHead>
                <TableHead className="whitespace-nowrap">Details</TableHead>
                <TableHead className="whitespace-nowrap">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="py-9 text-center text-m-text-muted">
                    Loading log entries...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="p-0">
                    <EmptyState
                      title="No log entries match these filters."
                      description="Try widening the date range or clearing a filter."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const isExpanded = Boolean(expandedRows[entry.id]);
                  return (
                    <Fragment key={entry.id}>
                      <TableRow clickable onClick={() => toggleRow(entry.id)}>
                        <TableCell className="whitespace-nowrap font-mono text-[11px] text-m-text-muted">
                          {formatTimestamp(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar name={entry.agent} size="xs" />
                            <span className="font-medium">{entry.agent}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_BADGE_VARIANT[entry.actionClass]} appearance="subtle" size="sm">
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{entry.module}</TableCell>
                        <TableCell className="font-mono text-[11px]">{entry.entity}</TableCell>
                        <TableCell className="text-m-text-muted">{entry.details}</TableCell>
                        <TableCell
                          className={`font-semibold ${entry.result === "Denied" ? "text-m-error" : "text-m-success"}`}
                        >
                          {entry.result}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={COLUMN_COUNT} className="bg-m-surface-2/40 p-4">
                            <div className="space-y-3">
                              <div className="divide-y divide-m-border rounded-m-lg border border-m-border bg-m-surface">
                                {entry.fields.map((field) => (
                                  <div key={field.label} className="flex items-center gap-3 px-4 py-2 text-xs">
                                    <span className="w-36 shrink-0 font-semibold uppercase tracking-wide text-m-text-muted">
                                      {field.label}
                                    </span>
                                    {field.after !== undefined ? (
                                      <div className="flex items-center gap-2">
                                        <span className="rounded-m-md bg-m-error-light px-2 py-0.5 text-m-error line-through">
                                          {field.before}
                                        </span>
                                        <Icon name="arrow-right" size="xs" className="text-m-text-muted" />
                                        <span className="rounded-m-md bg-m-success-light px-2 py-0.5 font-semibold text-m-success">
                                          {field.after}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="font-semibold text-m-text">{field.value}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-4 text-xs text-m-text-muted">
                                <span>
                                  <strong className="text-m-text">IP:</strong> {entry.ipAddress}
                                </span>
                                <span>
                                  <strong className="text-m-text">Session:</strong> {entry.sessionId}
                                </span>
                                <span>
                                  <strong className="text-m-text">Entity link:</strong>{" "}
                                  {entry.entity === "—" ? "n/a" : entry.entity}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
