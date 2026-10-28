"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Icon } from "@/components/ui";
import { accountsDirectory } from "./data";
import type { AccountHealthStatus, AccountTier } from "./types";

export function AccountPortfolioView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "attention" | "quotes">("all");

  const accounts = Object.values(accountsDirectory);

  const visibleAccounts = accounts.filter((acc) => {
    const matchesSearch =
      !searchQuery ||
      `${acc.name} ${acc.headquarters} ${acc.industry} ${acc.contacts.map((c) => c.name).join(" ")}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    if (selectedFilter === "attention") {
      return matchesSearch && (acc.healthStatus === "Service Hold" || acc.healthStatus === "Attention Needed");
    }
    if (selectedFilter === "quotes") {
      return matchesSearch && acc.openQuotesValue > 0;
    }
    return matchesSearch;
  });

  const getHealthBadge = (status: AccountHealthStatus, score: number) => {
    switch (status) {
      case "Healthy":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {score}/100 · Healthy
          </span>
        );
      case "Attention Needed":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {score}/100 · Attention
          </span>
        );
      case "Service Hold":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Delivery Hold
          </span>
        );
      case "At Risk":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {score}/100 · At Risk
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              White Cap · Territory Accounts
            </span>
            <span className="text-xs text-muted-foreground">Branch #12 Portfolio</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Assigned Contractor Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Commercial contractors and jobsites managed by Alex Miller. Tap any account for a 60-second jobsite pre-call brief.
          </p>
        </div>

        <Link
          href="/today"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted shadow-sm transition-colors self-start md:self-auto"
        >
          <Icon name="layout-dashboard" size="xs" />
          <span>View Today's Action Cockpit</span>
        </Link>
      </div>

      {/* 2. Three Clean Territory Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
            🏢
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assigned Contractors
            </div>
            <div className="text-base font-bold text-foreground">
              38 Accounts · $4.8M Volume
            </div>
          </div>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center font-bold text-lg">
            🚨
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              Active Delivery Holds
            </div>
            <div className="text-base font-bold text-foreground">
              Oak Ridge & Summit
            </div>
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
            📑
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Open Quotes in Play
            </div>
            <div className="text-base font-bold text-foreground">
              $285.4K Active Pipeline
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search and Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search contractor, jobsite, contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none focus:border-primary shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setSelectedFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedFilter === "all"
                ? "bg-foreground text-background"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            All Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setSelectedFilter("attention")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedFilter === "attention"
                ? "bg-red-600 text-white"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            Needs Attention (2)
          </button>
          <button
            onClick={() => setSelectedFilter("quotes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedFilter === "quotes"
                ? "bg-amber-600 text-white"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            With Active Quotes
          </button>
        </div>
      </div>

      {/* 4. Streamlined Account Cards (High Contrast, Scannable) */}
      <div className="space-y-3.5">
        {visibleAccounts.map((account) => {
          const primaryContact = account.contacts.find((c) => c.isPrimary) || account.contacts[0];
          const hasDeliveryHold = account.healthStatus === "Service Hold";

          return (
            <div
              key={account.id}
              className={`rounded-2xl border p-5 bg-card transition-all duration-200 hover:shadow-md ${
                hasDeliveryHold
                  ? "border-red-500/40 hover:border-red-500/70"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Account Details */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-extrabold text-lg text-foreground">
                      {account.name}
                    </span>
                    {getHealthBadge(account.healthStatus, account.healthScore)}
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      {account.tier}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {account.headquarters} · {account.industry}
                  </p>

                  <div className="flex items-center gap-4 text-xs font-medium pt-1">
                    <span className="text-foreground font-semibold">
                      ${(account.annualSpend / 1000).toFixed(0)}K YTD Spend
                    </span>
                    {account.openQuotesValue > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        • ${(account.openQuotesValue / 1000).toFixed(1)}K Open Quotes
                      </span>
                    )}
                    {primaryContact && (
                      <span className="text-muted-foreground">
                        • Primary: {primaryContact.name} ({primaryContact.title})
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Action Button */}
                <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
                  <Link
                    href={`/accounts/${account.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <span>⚡ 60-Sec Jobsite Brief</span>
                    <Icon name="arrow-right" size="xs" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
