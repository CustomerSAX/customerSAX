import type { AgentTask, TaskUrgencyLevel } from "../types";

export interface StartMyDaySummary {
  greeting: string;
  urgentTicketsCount: number;
  delayedOrdersCount: number;
  pendingFollowupsCount: number;
  totalAttentionCount: number;
  rankedItems: AgentTask[];
  recommendedTask: AgentTask | null;
  briefingText: string;
  unavailableSources?: string[];
}

/**
 * Detects whether a natural-language query represents an intent to get a daily briefing
 * or start the day's workflow.
 */
export function isStartMyDayIntent(query: string): boolean {
  if (!query || typeof query !== "string") return false;
  const q = query.toLowerCase().trim();
  if (!q) return false;

  const patterns = [
    /\bstart\s+(my\s+)?(day|shift)\b/,
    /\b(daily|morning|today's?)\s+briefing\b/,
    /\b(give|show|fetch|get|run|provide)\s+(me\s+)?(a\s+|the\s+|my\s+)?(daily\s+)?briefing\b/,
    /\bbriefing\b/,
    /\brefresh\s+(my\s+)?briefing\b/,
    /\bwhat('s| is)\s+on\s+my\s+(plate|schedule|agenda|queue)\b/,
    /\bwhat\s+should\s+i\s+(do|focus on|work on)\s+today\b/,
    /\bwhat\s+needs\s+attention\s+today\b/,
    /\bmy\s+tasks?\s+today\b/,
  ];

  return patterns.some((p) => p.test(q));
}

/**
 * Returns a time-appropriate greeting based on the agent's current local time.
 */
export function getTimeAppropriateGreeting(date = new Date()): string {
  const hours = date.getHours();
  if (hours < 12) return "Good morning";
  if (hours < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Deterministically ranks operational items based on real urgency, deadlines, and customer impact:
 * 1. Urgent tickets (and tickets older than 4h)
 * 2. High priority tickets
 * 3. Orders with delivery delays or returns
 * 4. Pending quotes / approvals
 * 5. Normal open tickets
 */
export function rankOperationalItems(items: AgentTask[]): AgentTask[] {
  const urgencyWeight: Record<TaskUrgencyLevel, number> = {
    urgent: 4,
    high: 3,
    normal: 1,
    low: 0,
  };

  const typeWeight: Record<string, number> = {
    ticket: 3, // Tickets have highest human customer impact
    order: 2,  // Orders second (delivery risks)
    quote: 1,  // Commercial quotes third
  };

  return [...items].sort((a, b) => {
    const uA = urgencyWeight[a.priority ?? "normal"] ?? 1;
    const uB = urgencyWeight[b.priority ?? "normal"] ?? 1;
    if (uA !== uB) return uB - uA;

    const tA = typeWeight[a.type] ?? 0;
    const tB = typeWeight[b.type] ?? 0;
    if (tA !== tB) return tB - tA;

    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
}

/**
 * Builds a grounded, personalized Start My Day briefing directly from real retrieved records.
 * Never invents assignments, ticket counts, deadlines, or delivery risks.
 */
export function buildStartMyDayBriefing(
  items: AgentTask[],
  agentName?: string | null,
  localDate = new Date()
): StartMyDaySummary {
  const greetingPrefix = getTimeAppropriateGreeting(localDate);
  const greeting = agentName ? `${greetingPrefix}, ${agentName.split(" ")[0]}!` : `${greetingPrefix}!`;

  // Real counts computed directly from retrieved records
  const urgentTickets = items.filter(
    (item) => item.type === "ticket" && (item.priority === "urgent" || item.priority === "high")
  );
  const delayedOrders = items.filter(
    (item) => item.type === "order" && (item.priority === "urgent" || item.status === "Delayed")
  );
  const pendingQuotes = items.filter(
    (item) => item.type === "quote" && (item.priority === "high" || item.status === "Submitted" || item.status === "In Review")
  );

  const rankedItems = rankOperationalItems(items);
  const recommendedTask = rankedItems[0] ?? null;

  // Build natural summary text
  const parts: string[] = [];
  if (urgentTickets.length > 0) {
    parts.push(`${urgentTickets.length} urgent ${urgentTickets.length === 1 ? "ticket" : "tickets"}`);
  }
  if (delayedOrders.length > 0) {
    parts.push(`${delayedOrders.length} ${delayedOrders.length === 1 ? "order" : "orders"} at risk of delayed delivery`);
  }
  if (pendingQuotes.length > 0) {
    parts.push(`${pendingQuotes.length} pending ${pendingQuotes.length === 1 ? "follow-up" : "follow-ups"}`);
  }

  let summarySentence = "";
  if (parts.length === 0) {
    if (items.length > 0) {
      summarySentence = `You have ${items.length} open ${items.length === 1 ? "item" : "items"} on your queue, with no immediate urgent escalations.`;
    } else {
      summarySentence = "Your queue is currently clear! There are no urgent tickets, delivery delays, or pending follow-ups requiring attention.";
    }
  } else if (parts.length === 1) {
    summarySentence = `You have ${parts[0]} requiring attention today.`;
  } else if (parts.length === 2) {
    summarySentence = `You have ${parts[0]} and ${parts[1]}.`;
  } else {
    summarySentence = `You have ${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}.`;
  }

  // Highlight top 3 priority items to avoid overwhelming the conversational flow
  const topItems = rankedItems.slice(0, 3);
  const itemsList = topItems
    .map((item, idx) => {
      const typeLabel = item.type === "ticket" ? "Ticket" : item.type === "order" ? "Order" : "Quote";
      const customer = item.customerName ? ` (${item.customerName})` : "";
      return `${idx + 1}. **${typeLabel} ${item.referenceNumber}**${customer} — ${item.title} [${item.urgencyReason}]`;
    })
    .join("\n");

  let recommendation = "";
  if (recommendedTask) {
    const typeLabel = recommendedTask.type === "ticket" ? "urgent ticket" : recommendedTask.type === "order" ? "order" : "quote";
    recommendation = `I recommend starting with the ${typeLabel} **${recommendedTask.referenceNumber}** because the customer is awaiting a resolution. Would you like me to investigate it?`;
  }

  const lines = [
    `${greeting} ${summarySentence}`,
    topItems.length > 0 ? `\nTop priority items:\n${itemsList}` : "",
    recommendation ? `\n${recommendation}` : "",
  ].filter(Boolean);

  return {
    greeting,
    urgentTicketsCount: urgentTickets.length,
    delayedOrdersCount: delayedOrders.length,
    pendingFollowupsCount: pendingQuotes.length,
    totalAttentionCount: urgentTickets.length + delayedOrders.length + pendingQuotes.length,
    rankedItems,
    recommendedTask,
    briefingText: lines.join("\n"),
  };
}

/**
 * Resolves natural conversational references (e.g. "investigate the first ticket",
 * "what about the second order?", "open that ticket", "next urgent case")
 * against the grounded items from the briefing or priority queue.
 */
export function resolveFollowUpReference(
  query: string,
  contextItems: AgentTask[]
): AgentTask | null {
  const q = query.toLowerCase().trim();

  // 1. Direct reference number match (e.g. "CSA-102", "ORD-9981", "Q-500", "102")
  for (const item of contextItems) {
    const ref = item.referenceNumber.toLowerCase();
    if (q.includes(ref)) return item;
    const cleanRef = ref.replace(/^[a-z]+-?/i, "");
    if (cleanRef && cleanRef.length >= 3 && q.includes(cleanRef)) return item;
  }

  // 2. Positional references ("first ticket", "1st ticket", "first one", "second order", etc.)
  const ticketsOnly = contextItems.filter((i) => i.type === "ticket");
  const ordersOnly = contextItems.filter((i) => i.type === "order");

  if (q.includes("first ticket") || q.includes("1st ticket") || q.includes("ticket 1")) {
    return ticketsOnly[0] ?? null;
  }
  if (q.includes("second ticket") || q.includes("2nd ticket") || q.includes("ticket 2")) {
    return ticketsOnly[1] ?? null;
  }
  if (q.includes("first order") || q.includes("1st order") || q.includes("order 1")) {
    return ordersOnly[0] ?? null;
  }
  if (q.includes("second order") || q.includes("2nd order") || q.includes("order 2")) {
    return ordersOnly[1] ?? null;
  }

  // 3. General ordinal reference ("first one", "the first", "#1")
  if (q.includes("first") || q.includes("1st") || q.includes("start with the first") || q.includes("investigate it") || q.includes("yes please")) {
    return contextItems[0] ?? null;
  }
  if (q.includes("second") || q.includes("2nd")) {
    return contextItems[1] ?? null;
  }
  if (q.includes("third") || q.includes("3rd")) {
    return contextItems[2] ?? null;
  }

  // 4. "next urgent case" / "top priority" / "most urgent ticket"
  if (q.includes("most urgent") || q.includes("highest priority") || q.includes("top priority") || q.includes("urgent ticket")) {
    const urgentItems = contextItems.filter((i) => i.priority === "urgent" || i.priority === "high");
    return urgentItems[0] ?? ticketsOnly[0] ?? contextItems[0] ?? null;
  }
  if (q.includes("next urgent") || q.includes("next ticket") || q.includes("next case")) {
    const urgentItems = contextItems.filter((i) => i.priority === "urgent" || i.priority === "high");
    return urgentItems[1] ?? urgentItems[0] ?? contextItems[0] ?? null;
  }

  // 5. Customer name match
  for (const item of contextItems) {
    if (item.customerName && q.includes(item.customerName.toLowerCase())) {
      return item;
    }
  }

  return null;
}
