"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Badge,
  Tabs,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  ModalHeader,
  ModalBody,
  Drawer,
  DrawerHeader,
  DrawerContent,
  Input,
  Select,
  EmptyState,
  Skeleton,
} from "@csa/ui";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { useCompanies, useCompanyCommerceActivity } from "../hooks/use-companies";

type DetailTab = "general" | "address" | "cart" | "order" | "quote" | "employees";

const formatCurrencyNumber = (value: number) => value.toLocaleString("en-US");

export function CompanyDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { getCompanyById, updateCompany, addCompanyAddress, addCompanyAssociate, loading } = useCompanies();

  const company = getCompanyById(id);
  const {
    carts: activityCarts,
    orders: activityOrders,
    quotes: activityQuotes,
    error: activityError,
  } = useCompanyCommerceActivity(company?.key);
  const [activeTab, setActiveTab] = useState<DetailTab>("general");

  // Edit company state
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editName, setEditName] = useState(company?.name ?? "");
  const [editStatus, setEditStatus] = useState(company?.status ?? "Active");

  // Add Address state
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");

  // Add Associate state
  const [showAddAssociateModal, setShowAddAssociateModal] = useState(false);
  const [assocName, setAssocName] = useState("");
  const [assocEmail, setAssocEmail] = useState("");
  const [assocRole, setAssocRole] = useState("Buyer");

  const handleSaveAssociate = useCallback(() => {
    if (!company || !assocName || !assocEmail) return;
    const newId = `cst-${Date.now()}`;
    addCompanyAssociate(company.id, {
      customerId: newId,
      name: assocName,
      email: assocEmail,
      roles: [assocRole],
      status: "Active",
    });
    setAssocName("");
    setAssocEmail("");
    setShowAddAssociateModal(false);
  }, [addCompanyAssociate, assocEmail, assocName, assocRole, company]);

  const companyCarts = activityError ? [] : activityCarts;
  const companyOrders = activityError ? [] : activityOrders;
  const companyQuotes = activityError ? [] : activityQuotes;

  if (loading && !company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={<Skeleton width={280} height={32} />} subtitle={<Skeleton width={180} height={16} />} />
        <Panel>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </div>
        </Panel>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Company Not Found"
          actions={
            <Button variant="secondary" onClick={() => router.push("/b2b/company")}>
              Back to Companies
            </Button>
          }
        />
        <EmptyState
          icon="building-2"
          title="Company Not Found"
          description={`No company was found with ID or Key: ${id}`}
          action={
            <Button variant="primary" onClick={() => router.push("/b2b/company")}>
              Return to Companies
            </Button>
          }
        />
      </div>
    );
  }

  const handleUpdateGeneral = () => {
    updateCompany(company.id, {
      name: editName,
      status: editStatus,
    });
    setShowEditDrawer(false);
  };

  const handleSaveAddress = () => {
    if (!street || !city || !postalCode) return;
    addCompanyAddress(company.id, {
      streetName: street,
      city,
      state,
      postalCode,
      country,
    });
    setStreet("");
    setCity("");
    setState("");
    setPostalCode("");
    setShowAddAddressModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{company.name}</span>
            <Badge variant="neutral" appearance="subtle" size="md" className="font-mono">
              {company.key}
            </Badge>
            <Badge variant={company.status === "Active" ? "success" : "neutral"} size="md">
              {company.status}
            </Badge>
          </div>
        }
        subtitle={`${company.unitType} • Created ${formatDate(company.createdAt)}`}
        breadcrumbs={
          <div className="flex items-center gap-1 text-xs text-m-text-muted">
            <button onClick={() => router.push("/b2b/company")} className="hover:text-m-primary font-semibold">
              ← TO COMPANIES
            </button>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="arrow-left" size="xs" />}
              onClick={() => router.push("/b2b/company")}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="edit" size="xs" />}
              onClick={() => {
                setEditName(company.name);
                setEditStatus(company.status);
                setShowEditDrawer(true);
              }}
            >
              Edit Company
            </Button>
          </div>
        }
      />

      {/* Tabs matching Legacy CT-CSA Standalone */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as DetailTab)}>
        <Tabs.List>
          <Tabs.Trigger value="general">General</Tabs.Trigger>
          <Tabs.Trigger value="address">Address ({company.addresses.length})</Tabs.Trigger>
          <Tabs.Trigger value="cart">Cart ({companyCarts.length})</Tabs.Trigger>
          <Tabs.Trigger value="order">Order ({companyOrders.length})</Tabs.Trigger>
          <Tabs.Trigger value="quote">Quote ({companyQuotes.length})</Tabs.Trigger>
          <Tabs.Trigger value="employees">Employees ({company.associates.length})</Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: General */}
        <Tabs.Content value="general">
          <div className="flex flex-col gap-6 mt-4">
            <Panel title="General Information">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 text-sm">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Company Name
                  </span>
                  <span className="font-bold text-m-text text-base">{company.name}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Company Key
                  </span>
                  <span className="font-mono font-bold text-m-primary text-sm">{company.key}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Company Email
                  </span>
                  <span className="text-m-text">{company.associates[0]?.email ?? "admin@company.com"}</span>
                </div>
              </div>
            </Panel>

            <Panel title="Company Details">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-5 text-sm">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Company Type
                  </span>
                  <span className="font-semibold text-m-text">{company.unitType}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Parent Company
                  </span>
                  <span className="text-m-text">{company.parentName ?? "--"}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Associate Mode
                  </span>
                  <span className="text-m-text font-medium">Explicit</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Store Mode
                  </span>
                  <span className="text-m-text font-medium">Explicit</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Approval Rule Mode
                  </span>
                  <span className="text-m-text font-medium">Explicit</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Created
                  </span>
                  <span className="text-m-text">{formatDateTime(company.createdAt)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Last Modified
                  </span>
                  <span className="text-m-text">{formatDateTime(company.lastModifiedAt)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-m-text-muted block mb-1">
                    Credit Limit / Available
                  </span>
                  <span className="font-semibold text-m-success">
                    ${formatCurrencyNumber((company.creditLimit ?? 100000) - (company.creditUsed ?? 0))} / ${formatCurrencyNumber(company.creditLimit ?? 100000)}
                  </span>
                </div>
              </div>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 2: Address */}
        <Tabs.Content value="address">
          <div className="mt-4">
            <Panel
              title="Company Addresses"
              headerActions={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Icon name="plus" size="xs" />}
                  onClick={() => setShowAddAddressModal(true)}
                >
                  Add Address
                </Button>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Label</TableHead>
                    <TableHead>Street</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Postal Code</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.addresses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-m-text-muted">
                        No addresses recorded for this company.
                      </TableCell>
                    </TableRow>
                  ) : (
                    company.addresses.map((addr) => (
                      <TableRow key={addr.id}>
                        <TableCell className="font-semibold">{addr.companyName || company.name}</TableCell>
                        <TableCell>{addr.streetName} {addr.building ?? ""}</TableCell>
                        <TableCell>{addr.city}</TableCell>
                        <TableCell>{addr.state || "--"}</TableCell>
                        <TableCell>{addr.postalCode}</TableCell>
                        <TableCell>{addr.country}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {addr.isDefaultShipping && <Badge variant="success" size="sm">Default Shipping</Badge>}
                            {addr.isDefaultBilling && <Badge variant="info" size="sm">Default Billing</Badge>}
                            {!addr.isDefaultShipping && !addr.isDefaultBilling && <Badge variant="neutral" size="sm">Address</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 3: Cart */}
        <Tabs.Content value="cart">
          <div className="mt-4">
            <Panel title="Company Carts">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cart ID</TableHead>
                    <TableHead>Customer Email</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyCarts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-m-text-muted">
                        No carts currently open for this company.
                      </TableCell>
                    </TableRow>
                  ) : (
                    companyCarts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-semibold text-m-primary">{c.id}</TableCell>
                        <TableCell>{c.customerEmail}</TableCell>
                        <TableCell>{c.itemCount} items</TableCell>
                        <TableCell className="font-semibold">${c.totalPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={c.cartState === "Active" ? "success" : "neutral"} size="sm">
                            {c.cartState}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(c.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 4: Order */}
        <Tabs.Content value="order">
          <div className="mt-4">
            <Panel title="Company Orders">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer Email</TableHead>
                    <TableHead>Order State</TableHead>
                    <TableHead>Payment State</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-m-text-muted">
                        No orders recorded for this company.
                      </TableCell>
                    </TableRow>
                  ) : (
                    companyOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono font-semibold text-m-primary">{o.orderNumber}</TableCell>
                        <TableCell>{o.customerEmail}</TableCell>
                        <TableCell>
                          <Badge variant={o.orderState === "Complete" ? "success" : "info"} size="sm">
                            {o.orderState}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.paymentState === "Paid" ? "success" : "warning"} size="sm">
                            {o.paymentState}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">${o.totalPrice.toFixed(2)}</TableCell>
                        <TableCell>{formatDate(o.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 5: Quote */}
        <Tabs.Content value="quote">
          <div className="mt-4">
            <Panel title="Company Quotes">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote Number</TableHead>
                    <TableHead>Customer Email</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Valid To</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-m-text-muted">
                        No quote requests recorded for this company.
                      </TableCell>
                    </TableRow>
                  ) : (
                    companyQuotes.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono font-semibold text-m-primary">{q.quoteNumber}</TableCell>
                        <TableCell>{q.customerEmail}</TableCell>
                        <TableCell>
                          <Badge variant={q.status === "Approved" ? "success" : "info"} size="sm">
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">${q.negotiatedTotal.toFixed(2)}</TableCell>
                        <TableCell>{formatDate(q.validUntil)}</TableCell>
                        <TableCell>{formatDate(q.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 6: Employees */}
        <Tabs.Content value="employees">
          <div className="mt-4">
            <Panel
              title="Company Employees & Associates"
              headerActions={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Icon name="plus" size="xs" />}
                  onClick={() => setShowAddAssociateModal(true)}
                >
                  Add Employee
                </Button>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.associates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-m-text-muted">
                        No employees associated with this company.
                      </TableCell>
                    </TableRow>
                  ) : (
                    company.associates.map((assoc) => (
                      <TableRow key={assoc.customerId}>
                        <TableCell className="font-semibold">{assoc.name}</TableCell>
                        <TableCell>{assoc.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {assoc.roles.map((r) => (
                              <Badge key={r} variant="primary" size="sm">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={assoc.status === "Active" ? "success" : "neutral"} size="sm">
                            {assoc.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>
      </Tabs>

      {/* Edit Drawer */}
      {showEditDrawer && (
        <Drawer isOpen={showEditDrawer} onClose={() => setShowEditDrawer(false)}>
          <DrawerHeader title="Edit Company Details" onClose={() => setShowEditDrawer(false)} />
          <DrawerContent>
            <div className="flex flex-col gap-4 p-2">
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Company Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Status</label>
                <Select
                  value={editStatus}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                  ]}
                  onChange={(e) => setEditStatus(e.target.value as "Active" | "Inactive")}
                />
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowEditDrawer(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleUpdateGeneral}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Add Address Modal */}
      {showAddAddressModal && (
        <Modal isOpen={showAddAddressModal} onClose={() => setShowAddAddressModal(false)}>
          <ModalHeader title="Add Company Address" onClose={() => setShowAddAddressModal(false)} />
          <ModalBody>
            <div className="flex flex-col gap-4 p-2">
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Street</label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g. 100 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">State</label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Postal Code</label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal Code" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Country</label>
                  <Select
                    value={country}
                    options={[
                      { value: "US", label: "United States" },
                      { value: "GB", label: "United Kingdom" },
                      { value: "CA", label: "Canada" },
                    ]}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowAddAddressModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveAddress}>
                  Save Address
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Add Associate Modal */}
      {showAddAssociateModal && (
        <Modal isOpen={showAddAssociateModal} onClose={() => setShowAddAssociateModal(false)}>
          <ModalHeader title="Add Employee Associate" onClose={() => setShowAddAssociateModal(false)} />
          <ModalBody>
            <div className="flex flex-col gap-4 p-2">
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Employee Name</label>
                <Input value={assocName} onChange={(e) => setAssocName(e.target.value)} placeholder="Full Name" />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Employee Email</label>
                <Input value={assocEmail} onChange={(e) => setAssocEmail(e.target.value)} placeholder="Email" />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Role</label>
                <Select
                  value={assocRole}
                  options={[
                    { value: "Admin", label: "Admin" },
                    { value: "Buyer", label: "Buyer" },
                    { value: "Approver", label: "Approver" },
                  ]}
                  onChange={(e) => setAssocRole(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowAddAssociateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveAssociate}>
                  Add Employee
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
