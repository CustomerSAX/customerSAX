"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type QuoteRow = { id: string; ctStatus?: string; lastModifiedAt?: string };

/**
 * Saved AI review statuses for the visible quote rows. Read-only; refreshes every
 * 15 seconds while the page is visible. A failed lookup yields "unavailable", never
 * "not_analyzed", so an outage is not mistaken for "no review exists".
 */
export function useQuoteAIStatuses(quotes: QuoteRow[]) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const payload = useMemo(
    () =>
      quotes.slice(0, 100).map((quote) => ({
        id: quote.id,
        status: quote.ctStatus ?? "",
        lastModifiedAt: quote.lastModifiedAt || null
      })),
    [quotes]
  );
  const key = JSON.stringify(payload);

  const refresh = useCallback(async () => {
    const rows = JSON.parse(key) as typeof payload;
    if (!rows.length) return;
    try {
      const response = await fetch("/api/quotes/ai-statuses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quotes: rows })
      });
      if (!response.ok) throw new Error("AI status unavailable");
      const data = (await response.json()) as { statuses: Array<{ id: string; status: string }> };
      setStatuses(Object.fromEntries(data.statuses.map((item) => [item.id, item.status])));
    } catch {
      setStatuses(Object.fromEntries(rows.map((row) => [row.id, "unavailable"])));
    }
  }, [key]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { statuses, refresh };
}
