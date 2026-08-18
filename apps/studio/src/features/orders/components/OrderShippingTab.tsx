"use client";

import {
  Button,
  Input,
  Select,
  FormField,
  Label,
} from "@csa/ui";
import {
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  InfoList,
  InfoRow,
  Timeline,
  CardEmpty,
} from "@csa/ui";
import type { OrderShippingTabProps } from "./order-tab-types";
import type { TimelineItem } from "@csa/ui";

export function OrderShippingTab(props: OrderShippingTabProps & { orderTimeline: TimelineItem[] }) {
  const {
    order,
    selectedShippingMethodId, setSelectedShippingMethodId,
    shippingMethodFeedback, handleSaveShippingMethod,
    shippingMethods, shippingMethodsError,
    addressForm, setAddressForm, addressFeedback, handleSaveShippingAddress,
    orderTimeline,
  } = props;

  return (
        <ContentGrid>
          <MainColumn>
            <SectionCard title="Shipping Method" icon="truck">
              <div className="space-y-4">
                {shippingMethodFeedback && (
                  <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                    {shippingMethodFeedback}
                  </div>
                )}
                <FormField>
                  <Label>Select Shipping Method</Label>
                  <Select
                    value={selectedShippingMethodId}
                    onChange={(e) => setSelectedShippingMethodId(e.target.value)}
                    options={shippingMethods.map((m) => ({
                      value: m.id,
                      label: m.name,
                    }))}
                  />
                  {shippingMethodsError && (
                    <p className="text-xs font-semibold text-m-error">{shippingMethodsError}</p>
                  )}
                </FormField>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="primary" size="md" disabled={!selectedShippingMethodId} onClick={handleSaveShippingMethod}>
                    Save Shipping Method
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setSelectedShippingMethodId(order.shippingInfo.shippingMethodId || "")}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Shipping Details & Address" icon="map-pin">
              <form onSubmit={handleSaveShippingAddress} className="space-y-4">
                {addressFeedback && (
                  <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                    {addressFeedback}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField>
                    <Label>Shipped Quantity</Label>
                    <Input
                      value={String(order.lineItems.reduce((acc, li) => acc + li.quantity, 0))}
                      readOnly
                      className="bg-m-surface-2"
                    />
                  </FormField>
                  <FormField>
                    <Label>Shipping Tax</Label>
                    <Input value={`$${(order.shippingInfo.price * 0.08).toFixed(2)}`} readOnly className="bg-m-surface-2" />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField>
                    <Label>Street Number</Label>
                    <Input
                      value={addressForm.streetNumber || ""}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, streetNumber: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>Street Name</Label>
                    <Input
                      value={addressForm.streetName}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, streetName: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>Building</Label>
                    <Input
                      value={addressForm.building || ""}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, building: e.target.value }))}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField>
                    <Label>City</Label>
                    <Input
                      value={addressForm.city}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>State</Label>
                    <Input
                      value={addressForm.state}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>Postal Code</Label>
                    <Input
                      value={addressForm.postalCode}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                    />
                  </FormField>
                </div>

                <FormField>
                  <Label>Country</Label>
                  <Input
                    value={addressForm.country}
                    onChange={(e) => setAddressForm((prev) => ({ ...prev, country: e.target.value }))}
                  />
                </FormField>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" variant="primary" size="md">
                    Update Address
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setAddressForm(order.shippingAddress)}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard title={`Deliveries (${order.shippingInfo.parcels.length})`} icon="box">
              {order.shippingInfo.parcels.length > 0 ? (
                <div className="divide-y divide-m-border text-xs">
                  {order.shippingInfo.parcels.map((parcel, idx) => (
                    <div key={parcel.id} className="py-3 space-y-1">
                      <span className="font-bold text-m-text">Delivery #{idx + 1} (ID: {parcel.id})</span>
                      <div className="text-m-text-muted">Items Shipped: {parcel.itemsCount}</div>
                      <div className="text-m-primary font-mono font-bold pt-1">
                        Tracking ID:{" "}
                        <a
                          href={`https://www.fedex.com/fedextrack/?trknbr=${parcel.trackingId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {parcel.trackingId}
                        </a>{" "}
                        ({parcel.carrier})
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <CardEmpty
                  icon="box"
                  title="No deliveries yet"
                  hint="Parcel tracking information will appear here once a shipment is dispatched."
                />
              )}
            </SectionCard>
          </MainColumn>

          <SideColumn>
            <SectionCard title="Shipment Status" icon="activity">
              <Timeline items={orderTimeline} />
            </SectionCard>

            <SectionCard title="Shipping Summary" icon="info">
              <InfoList>
                <InfoRow label="Method" value={order.shippingInfo.shippingMethodName} />
                <InfoRow label="Carrier" value={order.shippingInfo.carrier} />
                <InfoRow label="Tax Rate" value={order.shippingInfo.taxRate} />
                <InfoRow label="Shipping Cost" value={`$${order.shippingInfo.price.toFixed(2)}`} />
              </InfoList>
            </SectionCard>
          </SideColumn>
        </ContentGrid>
  );
}
