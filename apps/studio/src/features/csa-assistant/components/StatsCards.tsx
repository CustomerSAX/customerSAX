"use client";

/**
 * Team-lead stats card, built from the real get_team_stats result (ai-assist
 * chat/tools/team-stats.ts): headline figures, bar breakdowns and a list whose
 * rows open the order or ticket they refer to. Every number is the tool's own.
 */

import { Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";

type TeamStats = {
  metric: string;
  title: string;
  subtitle: string;
  kpis: Array<{ label: string; value: string }>;
  groups: Array<{ title: string; rows: Array<{ label: string; value: number; display?: string }> }>;
  items: ItemList | null;
  moreItems?: ItemList[];
  note: string | null;
};

type ItemList = { title: string; columns: string[]; rows: Array<{ cells: string[]; prompt?: string }> };

/** A get_team_stats result, or null when this isn't one. */
export function teamStatsFromOutput(output: unknown): TeamStats | null {
  const s = output as (Partial<TeamStats> & { found?: boolean }) | null;
  if (!s || s.found !== true || typeof s.title !== "string" || !Array.isArray(s.kpis) || !Array.isArray(s.groups)) return null;
  return { ...(s as TeamStats), items: s.items ?? null, moreItems: s.moreItems ?? [], note: s.note || null };
}

function BarList({ rows }: { rows: TeamStats["groups"][number]["rows"] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-m-text" title={r.label}>{r.label}</span>
          <span className="h-2 rounded-full bg-m-surface-2 overflow-hidden">
            <span className="block h-full rounded-full bg-m-primary" style={{ width: `${Math.max((r.value / max) * 100, 4)}%` }} />
          </span>
          <span className="tabular-nums font-medium text-m-text text-right min-w-[1.5rem]">{r.display ?? r.value}</span>
        </div>
      ))}
    </div>
  );
}

function ItemsTable({ list, onSuggest, isLoading }: { list: ItemList; onSuggest?: (prompt: string) => void; isLoading: boolean }) {
  return (
    <div className="pt-2 border-t border-m-border">
      <p className="font-semibold text-m-text mb-1.5">{list.title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-m-text-muted">
              {list.columns.map((c) => (
                <th key={c} className="font-medium py-1 pr-3 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row, i) => {
              const canOpen = !!row.prompt && !!onSuggest && !isLoading;
              return (
                <tr
                  key={i}
                  className={`border-t border-m-border ${canOpen ? "cursor-pointer hover:bg-m-surface-2" : ""}`}
                  onClick={canOpen ? () => onSuggest!(row.prompt!) : undefined}
                  title={canOpen ? row.prompt : undefined}
                >
                  {row.cells.map((cell, j) => (
                    <td key={j} className={`py-1.5 pr-3 text-m-text ${j === 0 ? "whitespace-nowrap" : ""} max-w-[14rem] truncate`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TeamStatsCard({
  stats,
  onSuggest,
  isLoading = false
}: {
  stats: TeamStats;
  onSuggest?: (prompt: string) => void;
  isLoading?: boolean;
}) {
  const empty = stats.groups.length === 0 && !stats.items && !stats.moreItems?.length;
  return (
    <Card variant="default" className="my-2 w-full">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon name="bar-chart-3" size="xs" className="text-m-primary" />
          {stats.title}
        </CardTitle>
        <p className="text-xs text-m-text-muted">{stats.subtitle}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stats.kpis.map((k) => (
            <div key={k.label} className="rounded-m-md border border-m-border px-3 py-2">
              <p className="text-m-text-muted">{k.label}</p>
              <p className="text-base font-semibold text-m-text tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>

        {empty && <p className="text-m-text-muted">Nothing to show for this period.</p>}

        {stats.groups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-m-border">
            {stats.groups.map((g) => (
              <div key={g.title}>
                <p className="font-semibold text-m-text mb-1.5">{g.title}</p>
                <BarList rows={g.rows} />
              </div>
            ))}
          </div>
        )}

        {[stats.items, ...(stats.moreItems ?? [])].map((list) =>
          list && list.rows.length > 0 ? <ItemsTable key={list.title} list={list} onSuggest={onSuggest} isLoading={isLoading} /> : null
        )}

        {stats.note && <p className="text-m-text-muted italic">{stats.note}</p>}
      </CardContent>
    </Card>
  );
}
