"use client";

import {
  Button,
  Icon,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@csa/ui";
import {
  SectionCard,
  StatusPill,
  type StatusTone,
  CardEmpty,
} from "@csa/ui";
import type { OrderPayment } from "../types/order-types";
import type { OrderPaymentsTabProps } from "./order-tab-types";

function statusTone(status?: string | null): StatusTone {
  if (!status || status === "--") return "neutral";
  const s = status.toLowerCase();
  if (["paid", "complete", "shipped", "success", "approved", "refunded"].includes(s)) return "success";
  if (["pending", "ready", "initial", "open", "balancedue"].includes(s)) return "warning";
  if (["cancelled", "failed", "returned", "overdue", "declined", "voided"].includes(s)) return "error";
  if (["confirmed", "processing", "delayed", "backorder", "partial"].includes(s)) return "info";
  return "neutral";
}

export function OrderPaymentsTab(props: OrderPaymentsTabProps) {
  const {
    order, fmtDate, selectedPaymentId, setSelectedPaymentId,
    selectedPayment, paymentActionFeedback,
  } = props;

  return (
        <div className="flex flex-col gap-5">
          {paymentActionFeedback && (
            <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
              {paymentActionFeedback}
            </div>
          )}

          <SectionCard title="Payment Transactions" icon="credit-card" bodyClassName={order.payments && order.payments.length > 0 ? "p-0" : undefined}>
            {order.payments && order.payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Id</TableHead>
                    <TableHead>Interface Id</TableHead>
                    <TableHead>Amount planned</TableHead>
                    <TableHead>Payment method info</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((p: OrderPayment) => (
                    <TableRow
                      key={p.id}
                      clickable
                      onClick={() => setSelectedPaymentId(selectedPaymentId === p.id ? null : p.id)}
                    >
                      <TableCell className="font-mono text-xs font-bold text-m-primary">{p.id}</TableCell>
                      <TableCell className="font-mono text-xs text-m-text-muted">{p.interfaceId}</TableCell>
                      <TableCell className="font-bold text-xs">${p.amountPlanned.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-m-text">
                        <div>Name: {p.method}</div>
                        <div>PSP: {p.psp}</div>
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {fmtDate(p.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {fmtDate(p.lastModifiedAt || p.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <CardEmpty
                icon="credit-card"
                title="No payment records"
                hint="There are no payment records associated with this order."
              />
            )}
          </SectionCard>

          {/* Payment Detail Panel (Expandable) */}
          {selectedPayment && (
            <SectionCard
              title={`Payment ID: ${selectedPayment.id}`}
              icon="receipt"
              className="border-l-4 border-l-m-primary"
              action={
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedPaymentId(null)}>
                    Close
                  </Button>
                  <Button variant="secondary" size="sm" disabled>
                    PSP Sync Not Configured
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Icon name="mail" size="xs" />}
                    disabled
                  >
                    Payment Link Not Configured
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <span className="text-[11px] text-m-text-muted block -mt-2">
                  Created: {fmtDate(selectedPayment.createdAt)}
                </span>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-m-text-muted block">Payment Method Name</span>
                    <span className="font-semibold text-m-text">{selectedPayment.method}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">PSP Provider</span>
                    <span className="font-semibold text-m-text">{selectedPayment.psp}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">Interface ID</span>
                    <span className="font-mono text-m-text">{selectedPayment.interfaceId}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">Amount Planned</span>
                    <span className="font-bold text-m-text">${selectedPayment.amountPlanned.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">PSP Payment Status</span>
                    <StatusPill tone={statusTone(selectedPayment.pspPaymentStatus)}>
                      {selectedPayment.pspPaymentStatus}
                    </StatusPill>
                  </div>
                </div>

                <div className="pt-2 border-t border-m-border">
                  <h4 className="text-xs font-bold text-m-text mb-2">Transactions Breakdown</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Transaction type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Interaction ID</TableHead>
                        <TableHead>Transaction ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPayment.transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-xs text-m-text-muted">
                            {fmtDate(txn.timestamp)}
                          </TableCell>
                          <TableCell className="font-semibold text-xs">{txn.type}</TableCell>
                          <TableCell>
                            <StatusPill tone={statusTone(txn.state)}>{txn.state}</StatusPill>
                          </TableCell>
                          <TableCell className="font-bold text-xs">${txn.amount.toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs text-m-text-muted">{txn.interactionId}</TableCell>
                          <TableCell className="font-mono text-xs text-m-text-muted">{txn.id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
  );
}
