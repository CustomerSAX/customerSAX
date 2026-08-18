"use client";

import {
  Button,
  Icon,
  Input,
  Select,
  FormField,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Drawer,
} from "@csa/ui";
import {
  SectionCard,
  StatusPill,
  type StatusTone,
  PrimaryButton,
  CardEmpty,
} from "@/components/detail";
import type { OrderReturnsTabProps } from "./order-tab-types";

function statusTone(status?: string | null): StatusTone {
  if (!status || status === "--") return "neutral";
  const s = status.toLowerCase();
  if (["paid", "complete", "shipped", "success", "approved", "refunded"].includes(s)) return "success";
  if (["pending", "ready", "initial", "open", "balancedue"].includes(s)) return "warning";
  if (["cancelled", "failed", "returned", "overdue", "declined", "voided"].includes(s)) return "error";
  if (["confirmed", "processing", "delayed", "backorder", "partial"].includes(s)) return "info";
  return "neutral";
}

function ProductThumbnail({ src }: { src?: string }) {
  return (
    <div className="w-10 h-10 rounded-m-md overflow-hidden bg-m-surface-2 border border-m-border flex-shrink-0 flex items-center justify-center">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <Icon name="image" size="sm" className="text-m-text-muted" />
      )}
    </div>
  );
}

export function OrderReturnsTab(props: OrderReturnsTabProps) {
  const {
    order, fmtDate, isReturnDrawerOpen, handleOpenReturnDrawer, setIsReturnDrawerOpen,
    returnSelectedItems, setReturnSelectedItems, returnQuantities, setReturnQuantities,
    returnShipmentState, setReturnShipmentState, returnDateInput, setReturnDateInput,
    returnComment, setReturnComment, returnDrawerError, returnTrackingIdPreview, handleSubmitReturn,
  } = props;

  return (
        <div className="flex flex-col gap-5">
          <div className="flex justify-end">
            <PrimaryButton icon="plus" onClick={handleOpenReturnDrawer}>
              Create Order Return
            </PrimaryButton>
          </div>

          {order.returnInfo && order.returnInfo.length > 0 ? (
            order.returnInfo.map((ret, idx) => (
              <SectionCard
                key={ret.returnTrackingId || idx}
                title={`Return Request #${idx + 1}`}
                icon="rotate-ccw"
                action={
                  <span className="text-[11px] font-mono text-m-text-muted">
                    {ret.returnTrackingId} • {fmtDate(ret.returnDate)}
                  </span>
                }
                bodyClassName="p-0"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Shipment State</TableHead>
                      <TableHead>Payment State</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead>Comment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ret.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="flex items-center gap-3">
                          <ProductThumbnail src={item.imageUrl} />
                          <div>
                            <div className="font-bold text-xs text-m-text">{item.name}</div>
                            <div className="text-[10px] text-m-text-muted font-mono">
                              SKU: {item.sku} {item.key ? `· Key: ${item.key}` : ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">{item.quantity}</TableCell>
                        <TableCell>
                          <StatusPill tone={statusTone(item.shipmentState)}>{item.shipmentState}</StatusPill>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={statusTone(item.paymentState)}>{item.paymentState}</StatusPill>
                        </TableCell>
                        <TableCell className="text-xs text-m-text-muted">
                          {fmtDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs text-m-text-muted">{item.comment || "--"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            ))
          ) : (
            <SectionCard title="Returns" icon="rotate-ccw">
              <CardEmpty
                icon="rotate-ccw"
                title="No return records"
                hint='No return records recorded for this order. Click "Create Order Return" to initiate an RMA.'
              />
            </SectionCard>
          )}

          {/* Create Return Side Drawer */}
          <Drawer
            isOpen={isReturnDrawerOpen}
            onClose={() => setIsReturnDrawerOpen(false)}
            size="lg"
            position="right"
          >
            <Drawer.Header
              title="New Return Info"
              subtitle="Select ordered items and quantities to initiate an RMA request."
              onClose={() => setIsReturnDrawerOpen(false)}
            />
            <Drawer.Content className="space-y-4">
              {returnDrawerError && (
                <div className="p-2.5 bg-m-error-light text-m-error border border-m-error-border text-xs font-semibold rounded-m-md">
                  {returnDrawerError}
                </div>
              )}

              <FormField>
                <Label>Return Tracking Id</Label>
                <Input value={returnTrackingIdPreview} readOnly className="bg-m-surface-2 font-mono text-xs" />
              </FormField>

              <FormField>
                <Label>Return Date</Label>
                <Input
                  type="date"
                  value={returnDateInput}
                  onChange={(e) => setReturnDateInput(e.target.value)}
                />
              </FormField>

              <FormField>
                <Label>Shipment State</Label>
                <Select
                  value={returnShipmentState}
                  onChange={(e) => setReturnShipmentState(e.target.value as "Returned" | "Advised")}
                  options={[
                    { value: "Returned", label: "Returned (Warehouse received)" },
                    { value: "Advised", label: "Advised (RMA issued)" },
                  ]}
                />
              </FormField>

              <div>
                <Label>Ordered Items</Label>
                <p className="text-[11px] text-m-text-muted mb-2">
                  Select the items that should be grouped together in one return.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Return Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={Boolean(returnSelectedItems[li.id])}
                            onChange={(e) =>
                              setReturnSelectedItems((prev) => ({ ...prev, [li.id]: e.target.checked }))
                            }
                            className="rounded border-m-border"
                          />
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          <ProductThumbnail src={li.imageUrl} />
                          <div>
                            <div className="font-semibold text-xs">{li.name}</div>
                            <div className="text-[10px] text-m-text-muted font-mono">{li.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-m-text-muted">{li.quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={li.quantity}
                            disabled={!returnSelectedItems[li.id]}
                            value={returnQuantities[li.id] || 1}
                            onChange={(e) =>
                              setReturnQuantities((prev) => ({
                                ...prev,
                                [li.id]: Number(e.target.value),
                              }))
                            }
                            className="w-16 text-xs text-center"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <FormField>
                <Label>Comment</Label>
                <textarea
                  className="w-full p-2.5 border border-m-border rounded-m-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                  rows={2}
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                  placeholder="Reason for return..."
                />
              </FormField>
            </Drawer.Content>
            <Drawer.Footer>
              <Button variant="secondary" size="md" onClick={() => setIsReturnDrawerOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleSubmitReturn}>
                Submit Return
              </Button>
            </Drawer.Footer>
          </Drawer>
        </div>
  );
}
