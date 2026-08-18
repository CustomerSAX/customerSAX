"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@csa/ui";
import { useQuotes } from "../hooks/use-quotes";
import { useCompanies } from "@/features/companies/hooks/use-companies";
import { useEmployees } from "@/features/employees/hooks/use-employees";
import type { QuoteLineItem } from "../types/quote-types";

export function QuoteCreateView() {
  const router = useRouter();
  const { createQuote } = useQuotes();
  const { allCompanies } = useCompanies();
  const { allEmployees } = useEmployees();

  const [companyId, setCompanyId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [discountPct, setDiscountPct] = useState(10);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [note, setNote] = useState("");

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);

  const companyOptions = [
    { value: "", label: "Select Company / Business Unit" },
    ...allCompanies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const availableEmployees = allEmployees.filter(
    (e) => !companyId || e.memberships.some((m) => m.companyId === companyId)
  );

  const customerOptions = [
    { value: "", label: "Select Customer / Associate" },
    ...availableEmployees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName} (${e.email})`,
    })),
  ];

  const handleAddLineItem = () => {
    const newItem: QuoteLineItem = {
      id: `line-${Date.now()}`,
      sku: "",
      name: "",
      quantity: 1,
      listPrice: 0,
      negotiatedPrice: 0,
      subtotal: 0,
    };
    setLineItems((prev) => [...prev, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLineQtyChange = (id: string, qty: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const validQty = Math.max(1, qty);
        return {
          ...item,
          quantity: validQty,
          subtotal: item.negotiatedPrice * validQty,
        };
      })
    );
  };

  const handleLinePriceChange = (id: string, price: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const validPrice = Math.max(0, price);
        return {
          ...item,
          negotiatedPrice: validPrice,
          subtotal: validPrice * item.quantity,
        };
      })
    );
  };

  const grossSubtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const negotiatedTotal = grossSubtotal * ((100 - discountPct) / 100);

  const handleSave = (status: "Draft" | "Submitted") => {
    if (!companyId || lineItems.length === 0) return;

    const comp = allCompanies.find((c) => c.id === companyId);
    const cust = allEmployees.find((e) => e.id === customerId);

    const created = createQuote({
      companyId: comp?.id ?? "",
      companyName: comp?.name ?? "",
      companyKey: comp?.key ?? "",
      customerId: cust?.id ?? "",
      customerName: cust ? `${cust.firstName} ${cust.lastName}` : "",
      customerEmail: cust?.email ?? "",
      status,
      lineItems,
      subtotal: grossSubtotal,
      discountPct,
      negotiatedTotal,
      validUntil: new Date(validUntil).toISOString(),
    });

    router.push(`/b2b/quotes/${created.id}`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Create Quote Request"
        subtitle="Author a customized quote proposal with volume discounts on behalf of a buyer."
        breadcrumbs={
          <div className="flex items-center gap-1 text-xs text-m-text-muted">
            <button onClick={() => router.push("/b2b/quotes")} className="hover:text-m-primary">
              Quotes
            </button>
            <span>/</span>
            <span>Create</span>
          </div>
        }
        actions={
          <Button variant="secondary" size="md" onClick={() => router.push("/b2b/quotes")}>
            Cancel
          </Button>
        }
      />

      {/* Panel 1: Target Buyer & Company */}
      <Panel title="1. Buyer &amp; Company Context">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              Target Company <span className="text-m-danger">*</span>
            </label>
            <Select
              value={companyId}
              options={companyOptions}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setCustomerId("");
              }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">Customer Associate</label>
            <Select
              value={customerId}
              options={customerOptions}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>
        </div>
      </Panel>

      {/* Panel 2: Line Items Builder */}
      <Panel
        title={`2. Quote Line Items (${lineItems.length})`}
        headerActions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="plus" size="xs" />}
            onClick={handleAddLineItem}
          >
            Add Product Item
          </Button>
        }
      >
        <div className="p-5 flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="w-24">Quantity</TableHead>
                <TableHead className="w-32">List Price ($)</TableHead>
                <TableHead className="w-36">Negotiated Unit ($)</TableHead>
                <TableHead className="w-32 text-right">Line Total ($)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-m-text-muted">
                    No line items added yet. Click &quot;Add Product Item&quot; to build the quote proposal.
                  </TableCell>
                </TableRow>
              ) : (
                lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-m-text-muted">{item.sku}</TableCell>
                    <TableCell className="font-semibold text-m-text">{item.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleLineQtyChange(item.id, Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell className="text-m-text-muted">${item.listPrice.toFixed(2)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={item.negotiatedPrice}
                        onChange={(e) => handleLinePriceChange(item.id, Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold text-m-text">
                      ${item.subtotal.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        leftIcon={<Icon name="trash-2" size="xs" />}
                        onClick={() => handleRemoveLineItem(item.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* Panel 3: Financial Summary & Offer Settings */}
      <Panel title="3. Offer Terms &amp; Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">Volume Discount (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">Valid Until Date</label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>

            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">Offer Notes / Message</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Initial comments or terms for the buyer..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-m-xl bg-m-surface-1 border border-m-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-m-text mb-2">
              Quote Calculation Summary
            </h4>
            <div className="flex justify-between border-b border-m-border/60 pb-2 text-sm">
              <span className="text-m-text-muted">Gross Subtotal</span>
              <span className="font-semibold text-m-text">${grossSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2 text-sm">
              <span className="text-m-text-muted">Applied Discount</span>
              <span className="font-semibold text-m-success">-{discountPct}%</span>
            </div>
            <div className="flex justify-between text-base pt-1">
              <span className="font-bold text-m-text">Negotiated Total</span>
              <span className="font-bold text-m-primary">${negotiatedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Action Footer */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" size="md" onClick={() => router.push("/b2b/quotes")}>
          Cancel
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={!companyId || lineItems.length === 0}
          onClick={() => handleSave("Draft")}
        >
          Save as Draft
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={!companyId || lineItems.length === 0}
          onClick={() => handleSave("Submitted")}
        >
          Submit Quote to Buyer
        </Button>
      </div>
    </div>
  );
}
