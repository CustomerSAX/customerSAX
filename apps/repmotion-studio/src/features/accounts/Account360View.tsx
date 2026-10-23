"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Icon } from "@/components/ui";
import { accountsDirectory } from "./data";

interface Account360ViewProps {
  accountId: string;
}

export function Account360View({ accountId }: Account360ViewProps) {
  const [activeTab, setActiveTab] = useState<"orders" | "quotes" | "contacts">("orders");
  const [showBrief, setShowBrief] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fallback to oakridge if unknown
  const account = accountsDirectory[accountId] || accountsDirectory.oakridge;
  const primaryContact = account.contacts.find((c) => c.isPrimary) || account.contacts[0];
  const hasDeliveryHold = account.healthStatus === "Service Hold";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900/95 border border-emerald-500/50 text-white px-5 py-3.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
            ✓
          </div>
          <p className="text-sm font-medium leading-snug">{toastMessage}</p>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-300/70 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Back Link */}
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icon name="arrow-left" size="xs" />
        <span>Back to Assigned Accounts</span>
      </Link>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              White Cap · {account.tier} Contractor
            </span>
            <span className="text-xs text-muted-foreground">• Managed by {account.accountManager}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {account.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Primary Jobsite: Site 02 · Northway Commercial Center (Branch #12)
          </p>
        </div>

        {/* Action Toggle for 60-Sec Brief */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBrief(!showBrief)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
              showBrief
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "border border-border bg-card hover:bg-muted text-foreground"
            }`}
          >
            <span>⚡ {showBrief ? "Hide Jobsite Brief" : "Open 60-Sec Jobsite Brief (WC03)"}</span>
          </button>
        </div>
      </div>

      {/* 2. White Cap 60-Second Jobsite Visit Brief (WC03) */}
      {showBrief && (
        <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6 space-y-5 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="text-base font-extrabold text-foreground">
                60-Second Jobsite Pre-Call Brief (Alex Miller)
              </h3>
            </div>
            <span className="text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/20">
              Stationary Field Prep
            </span>
          </div>

          {/* Critical Operational Safety Check (Red Alert) */}
          {hasDeliveryHold && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs space-y-1.5">
              <div className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 text-sm">
                <span>🚨</span>
                <span>Active Delivery Discrepancy on Jobsite</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Order #WC-1042:</strong> Pallet 2 (20 boxes tie-wire) was delayed from Branch #12. Branch courier van dispatched at 8:15 AM (ETA: 10:45 AM before 11:30 AM pour).
              </p>
              <div className="text-[11px] font-semibold text-red-700 dark:text-red-300 pt-1">
                ⚠️ Operational Rule: Do NOT pitch new accessories until Dave confirms the tie-wire is safely in the trailer.
              </div>
            </div>
          )}

          {/* Meeting Objective */}
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Meeting Objective:
            </div>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {account.conversationPlan.meetingObjective}
            </p>
          </div>

          {/* 3 Smart Conversation Starters */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              3 Targeted Discussion Questions:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {account.conversationPlan.keyQuestionsToAsk.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-card border border-border/80 text-xs text-foreground/90 space-y-1"
                >
                  <span className="font-bold text-primary">Q{idx + 1}:</span>
                  <p className="text-muted-foreground leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Three Clean Tabs: Orders, Quotes, Contacts */}
      <div className="border-b border-border flex items-center gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab("orders")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "orders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          📦 Active Orders & Deliveries ({account.orders.length})
        </button>
        <button
          onClick={() => setActiveTab("quotes")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "quotes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          📑 Quotes & Bids ({account.quotes.length})
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "contacts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          👥 Jobsite Contacts ({account.contacts.length})
        </button>
      </div>

      {/* 4. Tab Content */}
      <div className="space-y-4">
        {/* Tab 1: Orders & Deliveries (Split Shipments WC01/WC02) */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {account.orders.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground bg-card rounded-2xl border border-border">
                No active orders for this account today.
              </div>
            ) : (
              account.orders.map((order) => (
                <div
                  key={order.id}
                  className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-foreground">
                          Order #{order.orderNumber}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          {order.orderState}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Destination: {order.deliveryAddress}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-foreground">
                        ${order.amount.toLocaleString()}
                      </div>
                      <span className="text-[11px] text-muted-foreground">Branch #12 Fulfillment</span>
                    </div>
                  </div>

                  {/* Split Shipment Tracking breakdown */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Split Shipment Logistics (White Cap WC02)
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* SH-01 */}
                      <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                        <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-300">
                          <span>✓ Shipment SH-01 (Anchors)</span>
                          <span>Delivered 7:30 AM</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          20 boxes 1/2in x 7in Wedge Anchors. Signed by Dave Henderson. Digital Proof of Delivery image archived.
                        </p>
                      </div>

                      {/* SH-02 */}
                      <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 space-y-2">
                        <div className="flex justify-between font-bold text-red-700 dark:text-red-300">
                          <span>⚠️ Shipment SH-02 (Tie-Wire)</span>
                          <span>Courier Van En Route</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          20 boxes heavy rebar tie-wire. Carrier delayed 90 mins. Branch van ETA: 10:45 AM.
                        </p>
                        <Button
                          size="sm"
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs"
                          onClick={() =>
                            showToast("📞 Connected to Branch #12 Dispatch (Gary). Van confirmed 10 mins away.")
                          }
                        >
                          📞 Call Courier Driver
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Quotes & Bids */}
        {activeTab === "quotes" && (
          <div className="space-y-4">
            {account.quotes.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground bg-card rounded-2xl border border-border">
                No active quotes for this account.
              </div>
            ) : (
              account.quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-foreground">
                          Quote #{quote.quoteNumber}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {quote.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{quote.title}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-foreground">
                        ${quote.totalAmount.toLocaleString()}
                      </div>
                      <span className="text-[11px] text-muted-foreground">Valid until {quote.validUntil}</span>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Line Items ({quote.lineItems.length})
                    </div>
                    <div className="divide-y divide-border/60 text-xs">
                      {quote.lineItems.map((line, i) => (
                        <div key={i} className="py-2 flex justify-between">
                          <div>
                            <span className="font-semibold text-foreground">{line.name}</span>
                            <span className="text-muted-foreground ml-2">({line.quantity} units)</span>
                          </div>
                          <span className="font-bold text-foreground">${line.subtotal.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex justify-end">
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
                      onClick={() =>
                        showToast(`⚡ 1-Click E-Sign Link copied and emailed to ${primaryContact.name}.`)
                      }
                    >
                      ⚡ Send 1-Click Accept Link
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Key Jobsite Contacts */}
        {activeTab === "contacts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {account.contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-5 rounded-2xl border border-border bg-card flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center">
                    {contact.avatarInitials}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-foreground">{contact.name}</div>
                    <div className="text-xs text-muted-foreground">{contact.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{contact.phone}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`tel:${contact.phone}`}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:opacity-90 transition-opacity"
                  >
                    Call
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
