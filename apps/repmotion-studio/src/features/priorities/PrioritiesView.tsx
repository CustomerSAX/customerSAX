"use client";

import { useState } from "react";
import { Badge, Button, Icon } from "@/components/ui";
import { initialPriorities } from "./data";
import type { PriorityItem } from "./types";

export function PrioritiesView() {
  const [priorities, setPriorities] = useState<PriorityItem[]>(initialPriorities);
  const [activeDrawerItem, setActiveDrawerItem] = useState<PriorityItem | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Primary 3 active items vs secondary items
  const activeItems = priorities.filter((p) => !p.completed);
  const completedItems = priorities.filter((p) => p.completed);
  const topFocusItems = priorities.slice(0, 3);

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  const markComplete = (id: string, customMessage?: string) => {
    setPriorities((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isDone = !item.completed;
          showToast(
            customMessage ||
              (isDone
                ? `✓ Completed: "${item.title}" marked done.`
                : `Reopened: "${item.title}" returned to queue.`)
          );
          return {
            ...item,
            completed: isDone,
            completedAt: isDone ? "Today at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined
          };
        }
        return item;
      })
    );
    if (activeDrawerItem && activeDrawerItem.id === id) {
      setActiveDrawerItem((prev) =>
        prev
          ? {
              ...prev,
              completed: !prev.completed,
              completedAt: !prev.completed ? "Today" : undefined
            }
          : null
      );
    }
  };

  const handleActionClick = (item: PriorityItem, actionType: string) => {
    if (actionType === "open_drawer") {
      setActiveDrawerItem(item);
    } else if (actionType === "call_dispatch") {
      markComplete(
        item.id,
        `✓ Branch #12 Hot-Shot Courier Dispatched! 20 boxes tie-wire en route to Northway Site 02. ETA: 10:45 AM (before 11:30 AM pour).`
      );
    } else if (actionType === "send_accept_link") {
      markComplete(
        item.id,
        `✓ 1-Click E-Sign Link copied and sent to Marcus Vance (Apex Framing) for Quote #Q-410 ($42,800). Price locked.`
      );
    } else if (actionType === "send_submittal") {
      markComplete(
        item.id,
        `✓ Engineering Submittal transmitted to Elena Rostova (Metro Foundations). ASTM C881 certification packet delivered.`
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900/95 border border-emerald-500/50 text-white px-5 py-3.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
            ✓
          </div>
          <p className="text-sm font-medium leading-snug">{successToast}</p>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-300/70 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Serene, Clutter-Free Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              White Cap · Midwest District
            </span>
            <span className="text-xs text-muted-foreground">Outside Account Manager</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Today's Action Cockpit
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {activeItems.length > 0
              ? `You have ${activeItems.length} decisions requiring attention before afternoon jobsite walkthroughs.`
              : "All priorities are completed for today. Great execution!"}
          </p>
        </div>

        {/* Clean Progress Meter */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 min-w-[220px] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-muted-foreground">Daily Focus Progress</span>
            <span className={completedItems.length === priorities.length ? "text-emerald-500 font-bold" : "text-foreground"}>
              {completedItems.length} of {priorities.length} Resolved
            </span>
          </div>
          <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500 ease-out rounded-full"
              style={{ width: `${(completedItems.length / priorities.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Three Clean Summary Badges (Glanceable in 2 seconds) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center font-bold text-lg">
            🚨
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              Delivery Exception
            </div>
            <div className="text-sm font-semibold text-foreground">
              Oak Ridge (Site 02 Slab Pour)
            </div>
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
            ⚡
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Expiring Quote (5 PM)
            </div>
            <div className="text-sm font-semibold text-foreground">
              Apex Framing · $42,800
            </div>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg">
            📋
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Field Promise Due
            </div>
            <div className="text-sm font-semibold text-foreground">
              Metro Foundations (Epoxy Submittal)
            </div>
          </div>
        </div>
      </div>

      {/* 3. The "Focus 3" Action Deck (Bite-Sized, Action-First, No Text Walls) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>Primary Focus Queue</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Ranked by Jobsite Urgency
            </span>
          </h2>
        </div>

        <div className="space-y-3.5">
          {topFocusItems.map((item, idx) => {
            const isDelivery = item.category === "service_hold";
            const isQuote = item.category === "quote_unblocked";
            const isPromise = item.category === "promise_due";

            return (
              <div
                key={item.id}
                className={`relative rounded-2xl border p-5 transition-all duration-200 ${
                  item.completed
                    ? "bg-muted/20 border-border/40 opacity-70"
                    : isDelivery
                    ? "bg-card border-red-500/30 hover:border-red-500/60 shadow-sm hover:shadow"
                    : isQuote
                    ? "bg-card border-amber-500/30 hover:border-amber-500/60 shadow-sm hover:shadow"
                    : "bg-card border-border hover:border-primary/50 shadow-sm hover:shadow"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Essential Story Only (No fluff) */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-base text-foreground">
                        {item.accountName}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isDelivery
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            : isQuote
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {item.urgencyLabel}
                      </span>
                    </div>

                    {/* Headline */}
                    <h3
                      className={`text-base font-semibold leading-snug ${
                        item.completed ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {item.title}
                    </h3>

                    {/* Exactly ONE crisp explanation sentence */}
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
                      {item.description}
                    </p>
                  </div>

                  {/* Right Column: Direct 1-Click Action Buttons */}
                  <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
                    {isDelivery && !item.completed && (
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
                        onClick={() => handleActionClick(item, "call_dispatch")}
                      >
                        📞 Dispatch Branch #12 Hot-Shot
                      </Button>
                    )}

                    {isQuote && !item.completed && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
                        onClick={() => handleActionClick(item, "send_accept_link")}
                      >
                        ⚡ Send 1-Click E-Sign Link
                      </Button>
                    )}

                    {isPromise && !item.completed && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                        onClick={() => handleActionClick(item, "send_submittal")}
                      >
                        ✓ Transmit Submittal Packet
                      </Button>
                    )}

                    {/* Secondary: Open Details Slide-Over Drawer */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleActionClick(item, "open_drawer")}
                    >
                      View Details →
                    </Button>

                    {/* Complete / Undo Checkbox Button */}
                    <button
                      onClick={() => markComplete(item.id)}
                      title={item.completed ? "Reopen" : "Mark as Done"}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                        item.completed
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 font-bold"
                          : "border-border text-muted-foreground hover:border-foreground/50 hover:bg-muted/40"
                      }`}
                    >
                      {item.completed ? "✓" : "○"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Collapsible Drawer / Explorer for the Rest of the Portfolio */}
      <div className="pt-4 border-t border-border/60">
        <button
          onClick={() => setShowAllAccounts(!showAllAccounts)}
          className="w-full py-3 px-4 rounded-xl border border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2">
            <Icon name="search" size="xs" />
            <span>Search or View Remaining Portfolio (38 Assigned Contractor Accounts)</span>
          </span>
          <span>{showAllAccounts ? "▲ Hide Portfolio" : "▼ Expand Full Territory (38)"}</span>
        </button>

        {showAllAccounts && (
          <div className="mt-4 p-5 rounded-2xl bg-card border border-border space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search contractor, jobsite or order # (e.g. Oak Ridge, WC-1042)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border focus:outline-none focus:border-primary"
              />
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {priorities
                .filter((p) =>
                  !searchQuery ||
                  p.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((p) => (
                  <div
                    key={p.id}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-muted/20 px-2 rounded-lg cursor-pointer"
                    onClick={() => setActiveDrawerItem(p)}
                  >
                    <div>
                      <div className="font-semibold text-foreground">{p.accountName}</div>
                      <div className="text-muted-foreground text-[11px]">{p.title}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{p.annualSpend}</span>
                      <Button size="sm" variant="secondary">
                        Open →
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Progressive Disclosure Slide-Over Drawer (100% Solid & High-Contrast) */}
      {activeDrawerItem && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setActiveDrawerItem(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 h-full border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200 flex flex-col justify-between"
            style={{ backgroundColor: "var(--color-bg-card, #ffffff)", opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-border">
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                    {activeDrawerItem.categoryLabel}
                  </span>
                  <h2 className="text-xl font-extrabold text-foreground mt-0.5">
                    {activeDrawerItem.accountName}
                  </h2>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    Jobsite: Site 02 · Northway Commercial Center
                  </p>
                </div>
                <button
                  onClick={() => setActiveDrawerItem(null)}
                  className="w-8 h-8 rounded-lg bg-muted/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground font-bold text-sm transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Status / Urgency Alert Box */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-1.5">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>📌</span>
                  <span>Situation Summary</span>
                </div>
                <div className="text-muted-foreground leading-relaxed">
                  {activeDrawerItem.description}
                </div>
              </div>

              {/* White Cap Specific: Split Shipment Inspection (WC01 / WC02) */}
              {activeDrawerItem.id === "priority-oakridge" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Order #WC-1042 · Split Shipments (Branch #12)
                    </h4>
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                      Pour at 11:30 AM
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Shipment 1: Delivered */}
                    <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                        <span>✓ Shipment SH-01 (20 Boxes Concrete Anchors)</span>
                        <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[11px]">Delivered 7:30 AM</span>
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        Foreman Dave signed on trailer tablet · Digital Proof of Delivery (POD) confirmed.
                      </div>
                    </div>

                    {/* Shipment 2: Delayed */}
                    <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-xs space-y-2.5">
                      <div className="flex items-center justify-between font-bold text-red-700 dark:text-red-300">
                        <span>⚠️ Shipment SH-02 (20 Boxes Tie-Wire)</span>
                        <span className="bg-red-500/20 px-2 py-0.5 rounded text-[11px]">Delayed at Branch #12</span>
                      </div>
                      <div className="text-muted-foreground text-[11px] leading-relaxed">
                        Carrier truck delayed 90 mins. Pour is blocked on jobsite without tie-wire.
                      </div>
                      <div className="pt-2 border-t border-red-500/20 flex gap-2">
                        <Button
                          size="sm"
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
                          onClick={() => {
                            handleActionClick(activeDrawerItem, "call_dispatch");
                            setActiveDrawerItem(null);
                          }}
                        >
                          ⚡ Dispatch Branch Van Hotline (ETA: 10:45 AM)
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* White Cap Specific: Expiring Quote (WC04) */}
              {activeDrawerItem.id === "priority-apex" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Quote #Q-410 Breakdown ($42,800)
                  </h4>
                  <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-xs space-y-2.5">
                    <div className="flex justify-between font-medium">
                      <span>80x 1/2in x 7in Wedge Anchors (Box of 25)</span>
                      <span className="font-semibold text-foreground">$25,600</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>40x Structural Framing Hardware Fasteners</span>
                      <span className="font-semibold text-foreground">$17,200</span>
                    </div>
                    <div className="pt-2.5 border-t border-border flex justify-between font-bold text-foreground text-sm">
                      <span>Total (Includes 8% Approved Margin Exception)</span>
                      <span className="text-emerald-600 dark:text-emerald-400">$42,800</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Jobsite Primary Contact */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-foreground">
                    {activeDrawerItem.primaryContact.name}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    {activeDrawerItem.primaryContact.role} · {activeDrawerItem.primaryContact.phone}
                  </div>
                </div>
                <a
                  href={`tel:${activeDrawerItem.primaryContact.phone}`}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-sm"
                >
                  Call Contact
                </a>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <button
                onClick={() => {
                  markComplete(activeDrawerItem.id);
                  setActiveDrawerItem(null);
                }}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {activeDrawerItem.completed ? "Reopen Priority" : "Mark as Resolved ✓"}
              </button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveDrawerItem(null)}
              >
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
