"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Icon,
  Input,
  Select,
  FormField,
  Label
} from "@csa/ui";
import { useCartStore } from "../hooks/use-carts";
import type { CartAddress } from "../types/cart-types";

interface CartAddressDetailsViewProps {
  id: string;
  mode?: "order" | "quote";
}

const COUNTRY_OPTIONS = [
  { value: "US", label: "United States (US)" },
  { value: "CA", label: "Canada (CA)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "DE", label: "Germany (DE)" }
];

type ShippingMethodOption = {
  id: string;
  name: string;
};

type CustomerSavedAddress = CartAddress & {
  id: string;
};

type CustomerAddressesResponse = {
  addresses?: CustomerSavedAddress[];
  defaultBillingAddressId?: string | null;
  defaultShippingAddressId?: string | null;
  billingAddressIds?: string[];
  shippingAddressIds?: string[];
  error?: string;
};

function compactAddress(address: CartAddress): CartAddress {
  return Object.fromEntries(
    Object.entries(address).filter(
      ([, value]) => typeof value !== "string" || value.trim().length > 0
    )
  ) as CartAddress;
}

function addressFromSavedAddress(address: CustomerSavedAddress): CartAddress {
  return {
    streetNumber: address.streetNumber || "",
    streetName: address.streetName || "",
    apartment: address.apartment || "",
    building: address.building || "",
    pOBox: address.pOBox || "",
    city: address.city || "",
    state: address.state || "",
    postalCode: address.postalCode || "",
    country: address.country || "US",
    region: address.region || "",
    additionalStreetInfo: address.additionalStreetInfo || "",
    additionalAddressInfo: address.additionalAddressInfo || "",
    phone: address.phone || "",
    mobile: address.mobile || ""
  };
}

function savedAddressLabel(
  address: CustomerSavedAddress,
  markers: { isBilling?: boolean; isDefaultBilling?: boolean; isDefaultShipping?: boolean; isShipping?: boolean }
) {
  const street = [address.streetNumber, address.streetName].filter(Boolean).join(" ");
  const location = [address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
  const markerText = [
    markers.isDefaultShipping ? "Default shipping" : "",
    markers.isDefaultBilling ? "Default billing" : "",
    !markers.isDefaultShipping && markers.isShipping ? "Shipping" : "",
    !markers.isDefaultBilling && markers.isBilling ? "Billing" : ""
  ].filter(Boolean);

  return [street || location || address.id, location && street ? location : "", markerText.join(" / ")]
    .filter(Boolean)
    .join(" - ");
}

export function CartAddressDetailsView({
  id,
  mode = "order"
}: CartAddressDetailsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");
  const isQuoteFlow = mode === "quote";

  const {
    loading,
    error,
    getCartById,
    updateBillingAddress,
    updateShippingMethod,
    updateCart
  } = useCartStore();

  const cart = getCartById(id);

  const [shippingChoice, setShippingChoice] = useState("__new__");
  const [billingChoice, setBillingChoice] = useState("__new__");
  const [isBillingSameAsShipping, setIsBillingSameAsShipping] = useState(true);

  // Address forms
  const [shippingForm, setShippingForm] = useState<CartAddress>({
    streetNumber: cart?.shippingAddress?.streetNumber || "",
    streetName: cart?.shippingAddress?.streetName || "",
    apartment: cart?.shippingAddress?.apartment || "",
    building: cart?.shippingAddress?.building || "",
    pOBox: cart?.shippingAddress?.pOBox || "",
    city: cart?.shippingAddress?.city || "",
    state: cart?.shippingAddress?.state || "",
    postalCode: cart?.shippingAddress?.postalCode || "",
    country: cart?.shippingAddress?.country || cart?.country || "US",
    phone: cart?.shippingAddress?.phone || ""
  });
  const [shippingAddressFeedback, setShippingAddressFeedback] = useState("");

  const [billingForm, setBillingForm] = useState<CartAddress>({
    streetNumber: cart?.billingAddress?.streetNumber || "",
    streetName: cart?.billingAddress?.streetName || "",
    apartment: cart?.billingAddress?.apartment || "",
    building: cart?.billingAddress?.building || "",
    pOBox: cart?.billingAddress?.pOBox || "",
    city: cart?.billingAddress?.city || "",
    state: cart?.billingAddress?.state || "",
    postalCode: cart?.billingAddress?.postalCode || "",
    country: cart?.billingAddress?.country || cart?.country || "US",
    phone: cart?.billingAddress?.phone || ""
  });
  const [billingAddressFeedback, setBillingAddressFeedback] = useState("");

  // Shipping Method
  const [selectedMethodId, setSelectedMethodId] = useState(
    cart?.shippingInfo.shippingMethodId || ""
  );
  const [shippingMethodFeedback, setShippingMethodFeedback] = useState("");
  const [shippingMethods, setShippingMethods] = useState<ShippingMethodOption[]>([]);
  const [shippingMethodsError, setShippingMethodsError] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddressesResponse>({
    addresses: [],
    billingAddressIds: [],
    shippingAddressIds: [],
    defaultBillingAddressId: null,
    defaultShippingAddressId: null
  });
  const [savedAddressesLoading, setSavedAddressesLoading] = useState(false);
  const [savedAddressesError, setSavedAddressesError] = useState("");
  const [savingNext, setSavingNext] = useState(false);
  const savingNextRef = useRef(false);
  const [savingSection, setSavingSection] = useState<
    "shipping" | "billing" | "method" | null
  >(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!cart) return;
    setShippingForm({
      streetNumber: cart.shippingAddress?.streetNumber || "",
      streetName: cart.shippingAddress?.streetName || "",
      apartment: cart.shippingAddress?.apartment || "",
      building: cart.shippingAddress?.building || "",
      pOBox: cart.shippingAddress?.pOBox || "",
      city: cart.shippingAddress?.city || "",
      state: cart.shippingAddress?.state || "",
      postalCode: cart.shippingAddress?.postalCode || "",
      country: cart.shippingAddress?.country || cart.country || "US",
      phone: cart.shippingAddress?.phone || ""
    });
    setBillingForm({
      streetNumber: cart.billingAddress?.streetNumber || "",
      streetName: cart.billingAddress?.streetName || "",
      apartment: cart.billingAddress?.apartment || "",
      building: cart.billingAddress?.building || "",
      pOBox: cart.billingAddress?.pOBox || "",
      city: cart.billingAddress?.city || "",
      state: cart.billingAddress?.state || "",
      postalCode: cart.billingAddress?.postalCode || "",
      country: cart.billingAddress?.country || cart.country || "US",
      phone: cart.billingAddress?.phone || ""
    });
    setSelectedMethodId(cart.shippingInfo.shippingMethodId || "");
  }, [cart]);

  useEffect(() => {
    let cancelled = false;

    async function loadShippingMethods() {
      try {
        const response = await fetch("/api/shipping-methods");
        const payload = (await response.json().catch(() => [])) as
          ShippingMethodOption[] | { error?: string };

        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(
            Array.isArray(payload)
              ? "Unable to load shipping methods."
              : payload.error || "Unable to load shipping methods."
          );
        }

        if (!cancelled) {
          setShippingMethods(payload);
          setShippingMethodsError("");
        }
      } catch (err) {
        if (!cancelled) {
          setShippingMethods([]);
          setShippingMethodsError(
            err instanceof Error ? err.message : "Unable to load shipping methods."
          );
        }
      }
    }

    void loadShippingMethods();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cart?.customerId) {
      setSavedAddresses({
        addresses: [],
        billingAddressIds: [],
        shippingAddressIds: [],
        defaultBillingAddressId: null,
        defaultShippingAddressId: null
      });
      setSavedAddressesError("");
      return;
    }

    let cancelled = false;

    async function loadSavedAddresses(customerId: string) {
      setSavedAddressesLoading(true);
      try {
        const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}/addresses`);
        const payload = (await response.json().catch(() => ({}))) as CustomerAddressesResponse;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load saved customer addresses.");
        }

        if (!cancelled) {
          setSavedAddresses({
            addresses: payload.addresses ?? [],
            billingAddressIds: payload.billingAddressIds ?? [],
            shippingAddressIds: payload.shippingAddressIds ?? [],
            defaultBillingAddressId: payload.defaultBillingAddressId ?? null,
            defaultShippingAddressId: payload.defaultShippingAddressId ?? null
          });
          setSavedAddressesError("");
        }
      } catch (err) {
        if (!cancelled) {
          setSavedAddresses({
            addresses: [],
            billingAddressIds: [],
            shippingAddressIds: [],
            defaultBillingAddressId: null,
            defaultShippingAddressId: null
          });
          setSavedAddressesError(
            err instanceof Error ? err.message : "Unable to load saved customer addresses."
          );
        }
      } finally {
        if (!cancelled) setSavedAddressesLoading(false);
      }
    }

    void loadSavedAddresses(cart.customerId);

    return () => {
      cancelled = true;
    };
  }, [cart?.customerId]);

  if (!cart) {
    return (
      <div className="space-y-6 pb-20">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to carts
        </Link>
        <Card variant="default">
          <CardContent className="p-8 text-center space-y-2">
            <div className="font-bold text-sm text-m-text">
              {loading ? "Loading cart" : "Cart not found"}
            </div>
            <p className="text-xs text-m-text-muted">
              {error ||
                (loading
                  ? "Fetching cart data from the commerce backend."
                  : "No cart matched this ID.")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const savedAddressOptions = (kind: "billing" | "shipping") => {
    const defaultAddressId =
      kind === "shipping"
        ? savedAddresses.defaultShippingAddressId
        : savedAddresses.defaultBillingAddressId;
    const sortedAddresses = [...(savedAddresses.addresses ?? [])].sort((a, b) => {
      if (a.id === defaultAddressId) return -1;
      if (b.id === defaultAddressId) return 1;
      return 0;
    });

    return [
      { value: "__new__", label: "New address (Manual entry)" },
      ...sortedAddresses.map((address) => ({
        value: address.id,
        label: savedAddressLabel(address, {
          isBilling: savedAddresses.billingAddressIds?.includes(address.id),
          isDefaultBilling: savedAddresses.defaultBillingAddressId === address.id,
          isDefaultShipping: savedAddresses.defaultShippingAddressId === address.id,
          isShipping: savedAddresses.shippingAddressIds?.includes(address.id)
        })
      }))
    ];
  };

  const handleShippingChoiceChange = (value: string) => {
    setShippingChoice(value);
    if (value === "__new__") return;

    const selected = savedAddresses.addresses?.find((address) => address.id === value);
    if (!selected) return;

    const nextAddress = addressFromSavedAddress(selected);
    setShippingForm(nextAddress);
    if (isBillingSameAsShipping) setBillingForm(nextAddress);
  };

  const handleBillingChoiceChange = (value: string) => {
    setBillingChoice(value);
    if (value === "__new__") return;

    const selected = savedAddresses.addresses?.find((address) => address.id === value);
    if (!selected) return;

    setBillingForm(addressFromSavedAddress(selected));
  };

  const handleSaveShippingAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    if (savingSection) return;
    setSavingSection("shipping");
    try {
      const address = compactAddress(shippingForm);
      const actions: Array<Record<string, unknown>> = [
        { setShippingAddress: { address } }
      ];
      if (isBillingSameAsShipping) actions.push({ setBillingAddress: { address } });
      await updateCart(cart.id, actions);
      if (isBillingSameAsShipping) setBillingForm(shippingForm);
      setShippingAddressFeedback("Shipping address saved successfully.");
      setTimeout(() => setShippingAddressFeedback(""), 3500);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save shipping address."
      );
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveBillingAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    if (savingSection) return;
    setSavingSection("billing");
    try {
      await updateBillingAddress(cart.id, compactAddress(billingForm));
      setBillingAddressFeedback("Billing address saved successfully.");
      setTimeout(() => setBillingAddressFeedback(""), 3500);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save billing address."
      );
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveShippingMethod = async () => {
    const m = shippingMethods.find((x) => x.id === selectedMethodId);
    if (!m) return;
    setSaveError("");
    if (savingSection) return;
    setSavingSection("method");
    try {
      await updateShippingMethod(cart.id, selectedMethodId, m.name);
      setShippingMethodFeedback(`Shipping method updated to ${m.name}.`);
      setTimeout(() => setShippingMethodFeedback(""), 3500);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save shipping method."
      );
    } finally {
      setSavingSection(null);
    }
  };

  const handleNext = async () => {
    if (savingNextRef.current) return;
    if (
      !shippingForm.streetName ||
      !shippingForm.city ||
      !shippingForm.postalCode ||
      !shippingForm.country
    ) {
      setSaveError(
        "Please complete required shipping address fields (Street Name, City, Postal Code, Country)."
      );
      return;
    }
    setSaveError("");
    savingNextRef.current = true;
    setSavingNext(true);
    const nextShippingAddress = compactAddress(shippingForm);
    const nextBillingAddress = compactAddress(
      isBillingSameAsShipping ? shippingForm : billingForm
    );
    try {
      const actions: Array<Record<string, unknown>> = [
        { setShippingAddress: { address: nextShippingAddress } },
        { setBillingAddress: { address: nextBillingAddress } }
      ];
      const m = shippingMethods.find((x) => x.id === selectedMethodId);
      if (m && !isQuoteFlow) {
        actions.push({
          setShippingMethod: {
            shippingMethod: { typeId: "shipping-method", id: selectedMethodId }
          }
        });
      }
      await updateCart(cart.id, actions);

      const nextPath = isQuoteFlow ? "create-quote-request" : "place-order";
      router.push(
        `/cart/${cart.id}/${nextPath}${customerIdParam ? `?customerId=${customerIdParam}` : ""}`
      );
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save cart addresses."
      );
      setSavingNext(false);
      savingNextRef.current = false;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <Link
          href={`/cart/${cart.id}${customerIdParam ? `?customerId=${customerIdParam}` : ""}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to cart
        </Link>

        <PageHeader
          title="Addresses & shipping"
          subtitle={
            isQuoteFlow
              ? "Confirm addresses and shipping before requesting a quote."
              : "Confirm addresses and shipping method before placing the order."
          }
          actions={
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push(`/cart/${cart.id}`)}
            >
              ← Back to cart
            </Button>
          }
        />
      </div>

      {/* Shipping & Billing Addresses Panel */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Shipping & Billing Addresses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField>
            <Label>Shipping address selection</Label>
            <Select
              value={shippingChoice}
              onChange={(e) => handleShippingChoiceChange(e.target.value)}
              options={savedAddressOptions("shipping")}
            />
            {savedAddressesLoading && (
              <p className="text-xs font-semibold text-m-text-muted">Loading saved addresses...</p>
            )}
            {savedAddressesError && (
              <p className="text-xs font-semibold text-m-error">{savedAddressesError}</p>
            )}
          </FormField>

          {/* Shipping Manual Entry Grid */}
          <div className="p-4 bg-m-bg rounded-lg border border-m-border space-y-4">
            <span className="text-xs font-bold text-m-text block">
              Shipping Address Details
            </span>
            {shippingAddressFeedback && (
              <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                {shippingAddressFeedback}
              </div>
            )}
            <form onSubmit={handleSaveShippingAddress} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField>
                  <Label>Street Number</Label>
                  <Input
                    value={shippingForm.streetNumber || ""}
                    onChange={(e) =>
                      setShippingForm((prev) => ({
                        ...prev,
                        streetNumber: e.target.value
                      }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>Street Name *</Label>
                  <Input
                    value={shippingForm.streetName}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, streetName: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField>
                  <Label>Apartment/Suite</Label>
                  <Input
                    value={shippingForm.apartment || ""}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, apartment: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>Building</Label>
                  <Input
                    value={shippingForm.building || ""}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, building: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>PO Box</Label>
                  <Input
                    value={shippingForm.pOBox || ""}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, pOBox: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField>
                  <Label>City *</Label>
                  <Input
                    value={shippingForm.city}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, city: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>State</Label>
                  <Input
                    value={shippingForm.state}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, state: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>Postal Code *</Label>
                  <Input
                    value={shippingForm.postalCode}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, postalCode: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField>
                  <Label>Country *</Label>
                  <Select
                    value={shippingForm.country}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, country: e.target.value }))
                    }
                    options={COUNTRY_OPTIONS}
                  />
                </FormField>
                <FormField>
                  <Label>Phone</Label>
                  <Input
                    value={shippingForm.phone || ""}
                    onChange={(e) =>
                      setShippingForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={savingSection === "shipping"}
                  disabled={savingSection !== null}
                >
                  Save Shipping Address
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShippingForm(cart.shippingAddress || shippingForm)}
                >
                  Reset
                </Button>
              </div>
            </form>
          </div>

          {/* Same as Billing Checkbox */}
          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="same-billing-check"
              checked={isBillingSameAsShipping}
              onChange={(e) => setIsBillingSameAsShipping(e.target.checked)}
              className="rounded border-m-border"
            />
            <label
              htmlFor="same-billing-check"
              className="text-xs font-semibold text-m-text cursor-pointer"
            >
              Use shipping address as billing address
            </label>
          </div>

          {/* Billing Address Section */}
          {!isBillingSameAsShipping && (
            <div className="space-y-4 pt-2">
              <FormField>
                <Label>Billing address selection</Label>
                <Select
                  value={billingChoice}
                  onChange={(e) => handleBillingChoiceChange(e.target.value)}
                  options={savedAddressOptions("billing")}
                />
              </FormField>

              <div className="p-4 bg-m-bg rounded-lg border border-m-border space-y-4">
                <span className="text-xs font-bold text-m-text block">
                  Billing Address Details
                </span>
                {billingAddressFeedback && (
                  <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                    {billingAddressFeedback}
                  </div>
                )}
                <form onSubmit={handleSaveBillingAddress} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField>
                      <Label>Street Number</Label>
                      <Input
                        value={billingForm.streetNumber || ""}
                        onChange={(e) =>
                          setBillingForm((prev) => ({
                            ...prev,
                            streetNumber: e.target.value
                          }))
                        }
                      />
                    </FormField>
                    <FormField>
                      <Label>Street Name *</Label>
                      <Input
                        value={billingForm.streetName}
                        onChange={(e) =>
                          setBillingForm((prev) => ({
                            ...prev,
                            streetName: e.target.value
                          }))
                        }
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField>
                      <Label>City *</Label>
                      <Input
                        value={billingForm.city}
                        onChange={(e) =>
                          setBillingForm((prev) => ({ ...prev, city: e.target.value }))
                        }
                      />
                    </FormField>
                    <FormField>
                      <Label>State</Label>
                      <Input
                        value={billingForm.state}
                        onChange={(e) =>
                          setBillingForm((prev) => ({ ...prev, state: e.target.value }))
                        }
                      />
                    </FormField>
                    <FormField>
                      <Label>Postal Code *</Label>
                      <Input
                        value={billingForm.postalCode}
                        onChange={(e) =>
                          setBillingForm((prev) => ({
                            ...prev,
                            postalCode: e.target.value
                          }))
                        }
                      />
                    </FormField>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={savingSection === "billing"}
                      disabled={savingSection !== null}
                    >
                      Save Billing Address
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Method Panel */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Shipping Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {shippingMethodFeedback && (
            <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
              {shippingMethodFeedback}
            </div>
          )}
          <FormField>
            <Label>Select Shipping Method</Label>
            <Select
              value={selectedMethodId}
              onChange={(e) => setSelectedMethodId(e.target.value)}
              options={shippingMethods.map((m) => ({
                value: m.id,
                label: m.name
              }))}
            />
            {shippingMethodsError && (
              <p className="text-xs font-semibold text-m-error">{shippingMethodsError}</p>
            )}
          </FormField>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={savingSection === "method"}
              disabled={!selectedMethodId || savingSection !== null}
              onClick={handleSaveShippingMethod}
            >
              Save Shipping Method
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() =>
                setSelectedMethodId(cart.shippingInfo.shippingMethodId || "")
              }
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-m-border shadow-lg flex items-center justify-between z-40 px-8">
        {saveError && (
          <div className="mr-4 rounded-m-md border border-m-error-border bg-m-error-surface px-3 py-2 text-xs font-semibold text-m-error">
            {saveError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(`/cart/${cart.id}`)}
          >
            Cancel
          </Button>
          <Button variant="secondary" size="md" onClick={() => router.back()}>
            Back
          </Button>
        </div>
        <Button variant="primary" size="md" disabled={savingNext} onClick={handleNext}>
          {savingNext ? "Saving..." : "Next →"}
        </Button>
      </div>
    </div>
  );
}
