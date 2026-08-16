"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@csa/ui";
import {
  BackLink,
  CardEmpty,
  ContentGrid,
  DetailPage,
  EntityHeader,
  EntityTabs,
  InfoList,
  InfoRow,
  MainColumn,
  PrimaryButton,
  QuickAction,
  QuickActions,
  SecondaryButton,
  SectionCard,
  SideColumn,
  StatusPill,
  SummaryCard,
  SummaryGrid,
  type EntityTab,
} from "@/components/detail";
import { formatCartMoney, useCartStore } from "../carts/hooks/use-carts";

type TabId = "general" | "items" | "recovery" | "payments" | "activity";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "layout-grid" },
  { id: "items", label: "Items", icon: "package" },
  { id: "recovery", label: "Recovery", icon: "life-buoy" },
  { id: "payments", label: "Payments", icon: "credit-card" },
  { id: "activity", label: "Activity", icon: "activity" },
];

export function CartDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { carts, loading, error, refetch } = useCartStore();
  const cart = carts.find((item) => item.id === id || item.key === id);

  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [refreshing, setRefreshing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<{
    id: string;
    orderNumber: string | null;
    totalLabel: string | null;
  } | null>(null);

  if (loading && !cart) {
    return (
      <DetailPage>
        <BackLink href="/cart">Back to Carts</BackLink>
        <Skeleton height={240} />
      </DetailPage>
    );
  }

  if (error) {
    return (
      <DetailPage>
        <BackLink href="/cart">Back to Carts</BackLink>
        <SectionCard title="Unable to load cart" icon="alert-triangle">
          <EmptyState title="Unable to load cart" description={error.message} />
        </SectionCard>
      </DetailPage>
    );
  }

  if (!cart) {
    return (
      <DetailPage>
        <BackLink href="/cart">Back to Carts</BackLink>
        <SectionCard title="Cart not found" icon="search">
          <EmptyState
            title="Cart not found"
            description="The requested cart is not present in the current commercetools project."
          />
        </SectionCard>
      </DetailPage>
    );
  }

  const itemCount = cart.lineItems.reduce((sum, item) => sum + item.quantity, 0);

  const tabs: EntityTab[] = TABS.map((tab) => ({
    ...tab,
    count: tab.id === "items" ? cart.lineItems.length : null,
  }));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleConvertToOrder() {
    if (!cart || converting) return;
    setConverting(true);
    setConvertError(null);
    try {
      const res = await fetch(`/api/carts/${encodeURIComponent(cart.id)}/order`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setConvertResult({
        id: data.id,
        orderNumber: data.orderNumber ?? null,
        totalLabel: data.totalLabel ?? null,
      });
      void refetch();
    } catch (err) {
      setConvertError(
        err instanceof Error ? err.message : "Unable to reach the commerce backend right now.",
      );
    } finally {
      setConverting(false);
    }
  }

  return (
    <DetailPage>
      <BackLink href="/cart">Back to Carts</BackLink>
      <EntityHeader
        title={`Cart ${cart.key || cart.id}`}
        meta={`Customer ${cart.customerName || "Guest / Unassigned"} • Version ${cart.version}`}
        actions={
          <>
            <SecondaryButton trailingIcon="chevron-down" disabled>
              More actions
            </SecondaryButton>
            <PrimaryButton icon="pencil" disabled>
              Edit Cart
            </PrimaryButton>
          </>
        }
      />
      <EntityTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {activeTab === "general" && (
        <>
          <SummaryGrid>
            <SummaryCard
              icon="user"
              label="Customer"
              value={cart.customerName || "Guest / Unassigned"}
              sub={cart.customerId ? `ID ${cart.customerId}` : undefined}
            />
            <SummaryCard
              icon="dollar-sign"
              label="Cart Value"
              value={formatCartMoney(cart.totalPrice)}
              tone="primary"
            />
            <SummaryCard icon="package" label="Items" value={itemCount} />
            <SummaryCard icon="banknote" label="Currency" value={cart.currencyCode} />
            <SummaryCard icon="hash" label="Version" value={cart.version} />
            <SummaryCard
              icon="fingerprint"
              label="Cart ID"
              value={<span className="font-mono text-[13px]">{cart.id}</span>}
            />
          </SummaryGrid>

          <ContentGrid>
            <MainColumn>
              <SectionCard title="Cart Details" icon="info">
                <InfoList columns={2}>
                  <InfoRow label="Cart ID" value={cart.id} mono />
                  <InfoRow label="Key" value={cart.key} mono />
                  <InfoRow label="Version" value={cart.version} />
                  <InfoRow label="Currency" value={cart.currencyCode} />
                  <InfoRow label="Customer" value={cart.customerName} />
                  <InfoRow label="Customer ID" value={cart.customerId} mono />
                </InfoList>
              </SectionCard>

              <SectionCard title="Shipping Address" icon="map-pin">
                <CardEmpty
                  icon="map-pin"
                  title="Not available for this cart"
                  hint="Shipping address isn't part of the cart data currently pulled from commercetools."
                />
              </SectionCard>

              <SectionCard title="Billing Address" icon="file-text">
                <CardEmpty
                  icon="file-text"
                  title="Not available for this cart"
                  hint="Billing address isn't part of the cart data currently pulled from commercetools."
                />
              </SectionCard>

              <SectionCard title="Discount Codes" icon="tag">
                <CardEmpty
                  icon="tag"
                  title="Not available for this cart"
                  hint="Applied discount/coupon codes aren't part of the cart data currently pulled from commercetools."
                />
              </SectionCard>
            </MainColumn>

            <SideColumn>
              <QuickActions>
                <QuickAction
                  icon="arrow-right-circle"
                  label={converting ? "Converting…" : "Convert to Order"}
                  onClick={handleConvertToOrder}
                  disabled={converting || cart.lineItems.length === 0 || Boolean(convertResult)}
                />
                <QuickAction
                  icon="refresh-cw"
                  label={refreshing ? "Refreshing…" : "Refresh Cart Data"}
                  onClick={handleRefresh}
                  disabled={refreshing}
                />
                <QuickAction
                  icon="user"
                  label="View Customer"
                  onClick={() => cart.customerId && router.push(`/customers/${cart.customerId}`)}
                  disabled={!cart.customerId}
                />
                <QuickAction icon="ticket" label="Create Ticket" disabled />
              </QuickActions>

              {convertResult && (
                <StatusPill tone="success">
                  Order {convertResult.orderNumber ?? convertResult.id} created
                  {convertResult.totalLabel ? ` • ${convertResult.totalLabel}` : ""}
                </StatusPill>
              )}
              {convertError && <StatusPill tone="error">{convertError}</StatusPill>}

              <SectionCard title="Session & Device" icon="monitor">
                <CardEmpty
                  icon="monitor"
                  title="Not available for this cart"
                  hint="Session, device, and IP metadata aren't tracked for carts pulled from commercetools."
                />
              </SectionCard>
            </SideColumn>
          </ContentGrid>
        </>
      )}

      {activeTab === "items" && (
        <ContentGrid>
          <MainColumn>
            <SectionCard
              title={`Line Items (${cart.lineItems.length})`}
              icon="package"
              bodyClassName={cart.lineItems.length > 0 ? "p-0" : undefined}
            >
              {cart.lineItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {["Product", "SKU", "Product ID", "Quantity", "Line Total"].map((column) => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.name}</TableCell>
                        <TableCell className="font-mono text-xs">{item.sku || "--"}</TableCell>
                        <TableCell className="font-mono text-xs">{item.productId || "--"}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCartMoney(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <CardEmpty icon="package" title="No items in this cart" />
              )}
            </SectionCard>
          </MainColumn>

          <SideColumn>
            <SectionCard title="Cart Totals" icon="dollar-sign">
              <InfoList>
                <InfoRow label="Items" value={itemCount} />
                <InfoRow label="Currency" value={cart.currencyCode} />
                <InfoRow label="Total" value={formatCartMoney(cart.totalPrice)} />
              </InfoList>
            </SectionCard>
          </SideColumn>
        </ContentGrid>
      )}

      {activeTab === "recovery" && (
        <SectionCard title="Cart Recovery" icon="life-buoy">
          <CardEmpty
            icon="life-buoy"
            title="No recovery activity"
            hint="Abandoned-cart recovery stage, journey, and recovery emails aren't tracked for carts pulled from commercetools yet."
          />
        </SectionCard>
      )}

      {activeTab === "payments" && (
        <SectionCard title="Payments" icon="credit-card">
          <CardEmpty
            icon="credit-card"
            title="No payment data available"
            hint="Carts have no payment records in commercetools until they're converted to an order."
          />
        </SectionCard>
      )}

      {activeTab === "activity" && (
        <SectionCard title="Activity" icon="activity">
          <CardEmpty
            icon="activity"
            title="No activity history"
            hint="Session and event timeline tracking isn't available for carts pulled from commercetools."
          />
        </SectionCard>
      )}
    </DetailPage>
  );
}
