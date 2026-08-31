"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@apollo/client";
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
} from "@csa/ui";
import { formatDate } from "@/lib/format-date";
import { useEmployees } from "../hooks/use-employees";
import { useCompanies } from "@/features/companies/hooks/use-companies";
import { useQuotes } from "@/features/quotes/hooks/use-quotes";
import { CUSTOMER_CARTS_QUERY, CUSTOMER_ORDERS_QUERY } from "@/features/orders/api/queries";

type EmployeeTab =
  | "profile"
  | "address"
  | "password"
  | "company"
  | "cart"
  | "quote"
  | "order"
  | "return"
  | "payment"
  | "ticket"
  | "custom-attributes";

type MoneyResult = {
  centAmount: number;
  fractionDigits: number;
};

type EmployeeCartsData = {
  b2bCarts: {
    results: Array<{
      id: string;
      key?: string | null;
      totalPrice?: MoneyResult | null;
      lineItems?: Array<{ quantity?: number | null }> | null;
    }>;
  };
};

type EmployeeOrdersData = {
  orderPage: {
    results: Array<{
      id: string;
      orderNumber?: string | null;
      orderState?: string | null;
      paymentState?: string | null;
      createdAt?: string | null;
      totalPrice?: MoneyResult | null;
    }>;
  };
};

const moneyToNumber = (money?: MoneyResult | null) => {
  if (!money) return 0;
  return money.centAmount / 10 ** money.fractionDigits;
};

export function EmployeeDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { getEmployeeById, loading: employeesLoading, updateEmployee, addEmployeeAddress, addEmployeeMembership } = useEmployees();
  const { allCompanies } = useCompanies();
  const { quotes } = useQuotes();

  const employee = getEmployeeById(id);
  const { data: cartsData } = useQuery<EmployeeCartsData>(CUSTOMER_CARTS_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: !employee?.id,
    variables: { customerId: employee?.id, limit: 20 },
  });
  const { data: ordersData } = useQuery<EmployeeOrdersData>(CUSTOMER_ORDERS_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: !employee?.id,
    variables: { customerId: employee?.id, limit: 20, offset: 0 },
  });
  const [activeTab, setActiveTab] = useState<EmployeeTab>("profile");

  // Profile Edit drawer
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editFirstName, setEditFirstName] = useState(employee?.firstName ?? "");
  const [editLastName, setEditLastName] = useState(employee?.lastName ?? "");
  const [editEmail, setEditEmail] = useState(employee?.email ?? "");
  const [editPhone, setEditPhone] = useState(employee?.phone ?? "");

  // Add Address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");

  // Add Membership modal
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedRole, setSelectedRole] = useState("Buyer");

  if (!employee && employeesLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Loading Employee" />
        <Panel title="Employee Details">
          <div className="p-6 text-sm text-m-text-muted">Loading employee record...</div>
        </Panel>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Employee Not Found"
          actions={
            <Button variant="secondary" onClick={() => router.push("/b2b/employees")}>
              Back to Employees
            </Button>
          }
        />
        <EmptyState
          icon="user-check"
          title="Employee Not Found"
          description={`No employee found with ID or Customer #: ${id}`}
          action={
            <Button variant="primary" onClick={() => router.push("/b2b/employees")}>
              Return to Employees
            </Button>
          }
        />
      </div>
    );
  }

  // Related data for this customer/employee
  const customerCarts = (cartsData?.b2bCarts.results ?? []).map((cart) => ({
    id: cart.key || cart.id,
    itemCount: (cart.lineItems ?? []).reduce((total, item) => total + (item.quantity ?? 0), 0),
    totalPrice: moneyToNumber(cart.totalPrice),
    cartState: "Active",
    createdAt: "",
  }));
  const customerOrders = (ordersData?.orderPage.results ?? []).map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber || order.id,
    companyName: employee.memberships[0]?.companyName || "--",
    orderState: order.orderState || "--",
    paymentState: order.paymentState || "--",
    totalPrice: moneyToNumber(order.totalPrice),
    createdAt: order.createdAt || "",
  }));
  const customerQuotes = quotes.filter((q) => q.customerEmail === employee.email || q.customerId === employee.id);

  const handleUpdateProfile = () => {
    updateEmployee(employee.id, {
      firstName: editFirstName,
      lastName: editLastName,
      email: editEmail,
      phone: editPhone,
    });
    setShowEditDrawer(false);
  };

  const handleAddAddress = () => {
    if (!street || !city || !postalCode) return;
    addEmployeeAddress(employee.id, {
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
    setShowAddressModal(false);
  };

  const handleAddMembership = () => {
    const comp = allCompanies.find((c) => c.id === selectedCompanyId);
    if (!comp) return;

    addEmployeeMembership(employee.id, {
      companyId: comp.id,
      companyName: comp.name,
      companyKey: comp.key,
      roles: [selectedRole],
    });
    setShowMembershipModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header matching legacy 360-View */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{employee.firstName} {employee.lastName} - 360 View</span>
            <Badge variant="primary" appearance="subtle" size="md">
              B2B Customer
            </Badge>
            <Badge variant={employee.status === "Active" ? "success" : "neutral"} size="md">
              {employee.status}
            </Badge>
          </div>
        }
        subtitle={employee.email}
        breadcrumbs={
          <div className="flex items-center gap-1 text-xs text-m-text-muted">
            <button onClick={() => router.push("/b2b/employees")} className="hover:text-m-primary font-semibold">
              ← Back to Customer List
            </button>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="edit" size="xs" />}
              onClick={() => {
                setEditFirstName(employee.firstName);
                setEditLastName(employee.lastName);
                setEditEmail(employee.email);
                setEditPhone(employee.phone ?? "");
                setShowEditDrawer(true);
              }}
            >
              Edit Profile
            </Button>
          </div>
        }
      />

      {/* 11 Legacy Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as EmployeeTab)}>
        <Tabs.List className="overflow-x-auto">
          <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
          <Tabs.Trigger value="address">Address ({employee.addresses.length})</Tabs.Trigger>
          <Tabs.Trigger value="password">Password</Tabs.Trigger>
          <Tabs.Trigger value="company">Company ({employee.memberships.length})</Tabs.Trigger>
          <Tabs.Trigger value="cart">Cart ({customerCarts.length})</Tabs.Trigger>
          <Tabs.Trigger value="quote">Quote ({customerQuotes.length})</Tabs.Trigger>
          <Tabs.Trigger value="order">Order ({customerOrders.length})</Tabs.Trigger>
          <Tabs.Trigger value="return">Return (0)</Tabs.Trigger>
          <Tabs.Trigger value="payment">Payment (1)</Tabs.Trigger>
          <Tabs.Trigger value="ticket">Ticket (1)</Tabs.Trigger>
          <Tabs.Trigger value="custom-attributes">Custom Attributes</Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: Profile (Customer General Profile) */}
        <Tabs.Content value="profile">
          <div className="mt-4">
            <Panel title="Customer General Profile" subtitle="Manage personal demographics, contact info, language, and customer group assignment.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 text-sm">
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Full Name</label>
                  <Input value={`${employee.firstName} ${employee.lastName}`} readOnly />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Occupation</label>
                  <Input defaultValue="Purchasing Specialist" readOnly />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Email</label>
                  <Input value={employee.email} readOnly />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Phone Number</label>
                  <Input value={employee.phone || "6787876679"} readOnly />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Company Name</label>
                  <Input value={employee.memberships[0]?.companyName || "ROYAL CYBER"} readOnly />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Preferred Language</label>
                  <Select value="en-US" options={[{ value: "en-US", label: "English (US)" }]} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Gender</label>
                  <Select value="not-specified" options={[{ value: "not-specified", label: "Select..." }]} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Age Group</label>
                  <Select value="not-specified" options={[{ value: "not-specified", label: "Select..." }]} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Preferred Currency</label>
                  <Select value="USD" options={[{ value: "USD", label: "USD - US Dollar" }]} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Customer Group</label>
                  <Select value="b2b" options={[{ value: "b2b", label: "B2B Customer" }]} />
                </div>
              </div>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 2: Address */}
        <Tabs.Content value="address">
          <div className="mt-4">
            <Panel
              title="Customer Addresses"
              headerActions={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Icon name="plus" size="xs" />}
                  onClick={() => setShowAddressModal(true)}
                >
                  Add Address
                </Button>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Street</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Postal Code</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.addresses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-m-text-muted">
                        No personal addresses added for this employee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employee.addresses.map((addr) => (
                      <TableRow key={addr.id}>
                        <TableCell>{addr.streetName} {addr.streetNumber ?? ""}</TableCell>
                        <TableCell>{addr.city}</TableCell>
                        <TableCell>{addr.state || "--"}</TableCell>
                        <TableCell>{addr.postalCode}</TableCell>
                        <TableCell>{addr.country}</TableCell>
                        <TableCell>
                          {addr.isDefaultShipping && <Badge variant="success" size="sm">Shipping</Badge>}
                          {addr.isDefaultBilling && <Badge variant="info" size="sm">Billing</Badge>}
                          {!addr.isDefaultShipping && !addr.isDefaultBilling && <Badge variant="neutral" size="sm">Standard</Badge>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 3: Password */}
        <Tabs.Content value="password">
          <div className="mt-4 max-w-lg">
            <Panel title="Reset Password">
              <div className="flex flex-col gap-4 p-5">
                <p className="text-xs text-m-text-muted">
                  Send a password reset email or update password credentials for this employee.
                </p>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">New Password</label>
                  <Input type="password" placeholder="At least 8 characters" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Confirm New Password</label>
                  <Input type="password" placeholder="Re-enter new password" />
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="primary" size="md">
                    Update Password
                  </Button>
                </div>
              </div>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 4: Company Memberships */}
        <Tabs.Content value="company">
          <div className="mt-4">
            <Panel
              title="Company Memberships & Associate Roles"
              headerActions={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Icon name="plus" size="xs" />}
                  onClick={() => setShowMembershipModal(true)}
                >
                  Assign to Company
                </Button>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Company Key</TableHead>
                    <TableHead>Assigned Roles</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.memberships.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-m-text-muted">
                        Employee has not been assigned to any B2B Company.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employee.memberships.map((mem) => (
                      <TableRow key={mem.companyId}>
                        <TableCell className="font-semibold text-m-primary">{mem.companyName}</TableCell>
                        <TableCell className="font-mono text-xs text-m-text-muted">{mem.companyKey}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {mem.roles.map((r) => (
                              <Badge key={r} variant="primary" size="sm">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-m-danger">
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 5: Cart */}
        <Tabs.Content value="cart">
          <div className="mt-4">
            <Panel title="Customer Open Carts">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cart ID</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Created Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerCarts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-m-text-muted">
                        No active carts found for this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerCarts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-semibold text-m-primary">{c.id}</TableCell>
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

        {/* Tab 6: Quote */}
        <Tabs.Content value="quote">
          <div className="mt-4">
            <Panel title="Customer Quotes">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote Number</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid To</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-m-text-muted">
                        No quotes submitted by this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerQuotes.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono font-semibold text-m-primary">{q.quoteNumber}</TableCell>
                        <TableCell>{q.companyName}</TableCell>
                        <TableCell className="font-semibold">${q.negotiatedTotal.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={q.status === "Approved" ? "success" : "info"} size="sm">
                            {q.status}
                          </Badge>
                        </TableCell>
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

        {/* Tab 7: Order */}
        <Tabs.Content value="order">
          <div className="mt-4">
            <Panel title="Customer Orders">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Order State</TableHead>
                    <TableHead>Payment State</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-m-text-muted">
                        No orders found for this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono font-semibold text-m-primary">{o.orderNumber}</TableCell>
                        <TableCell>{o.companyName ?? "--"}</TableCell>
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

        {/* Tab 8: Return */}
        <Tabs.Content value="return">
          <div className="mt-4">
            <Panel title="Customer Returns & Refunds">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return ID</TableHead>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Return State</TableHead>
                    <TableHead>Refund Amount</TableHead>
                    <TableHead>Created Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-m-text-muted">
                      No return requests recorded for this customer.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 9: Payment */}
        <Tabs.Content value="payment">
          <div className="mt-4">
            <Panel title="Payment Methods & Transactions">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-m-primary font-semibold">TXN-882910</TableCell>
                    <TableCell>Credit Card (Visa ending in 4242)</TableCell>
                    <TableCell className="font-semibold">$1,450.00</TableCell>
                    <TableCell>
                      <Badge variant="success" size="sm">Settled</Badge>
                    </TableCell>
                    <TableCell>{formatDate(employee.createdAt)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 10: Ticket */}
        <Tabs.Content value="ticket">
          <div className="mt-4">
            <Panel title="Support Tickets">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-m-primary font-semibold">TCK-1092</TableCell>
                    <TableCell className="font-semibold">Inquiry regarding volume pricing discount</TableCell>
                    <TableCell>
                      <Badge variant="warning" size="sm">Medium</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info" size="sm">In Progress</Badge>
                    </TableCell>
                    <TableCell>{formatDate(employee.createdAt)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 11: Custom Attributes */}
        <Tabs.Content value="custom-attributes">
          <div className="mt-4">
            <Panel title="Customer Custom Attributes">
              <div className="p-5 text-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attribute Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono font-semibold">b2bTaxExemptNumber</TableCell>
                      <TableCell className="text-m-text-muted">String</TableCell>
                      <TableCell className="font-mono">TAX-US-991204</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono font-semibold">preferredShippingCarrier</TableCell>
                      <TableCell className="text-m-text-muted">String</TableCell>
                      <TableCell>FedEx Freight</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Panel>
          </div>
        </Tabs.Content>
      </Tabs>

      {/* Profile Edit Drawer */}
      {showEditDrawer && (
        <Drawer isOpen={showEditDrawer} onClose={() => setShowEditDrawer(false)}>
          <DrawerHeader title="Edit Employee Profile" onClose={() => setShowEditDrawer(false)} />
          <DrawerContent>
            <div className="flex flex-col gap-4 p-2">
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">First Name</label>
                <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Last Name</label>
                <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Email</label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Phone</label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowEditDrawer(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleUpdateProfile}>
                  Save Profile
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Add Address Modal */}
      {showAddressModal && (
        <Modal isOpen={showAddressModal} onClose={() => setShowAddressModal(false)}>
          <ModalHeader title="Add Address" onClose={() => setShowAddressModal(false)} />
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
                <Button variant="secondary" onClick={() => setShowAddressModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleAddAddress}>
                  Save Address
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Assign Company Membership Modal */}
      {showMembershipModal && (
        <Modal isOpen={showMembershipModal} onClose={() => setShowMembershipModal(false)}>
          <ModalHeader title="Assign to Company" onClose={() => setShowMembershipModal(false)} />
          <ModalBody>
            <div className="flex flex-col gap-4 p-2">
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Company</label>
                <Select
                  value={selectedCompanyId}
                  options={[
                    { value: "", label: "Select a Company" },
                    ...allCompanies.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Role</label>
                <Select
                  value={selectedRole}
                  options={[
                    { value: "Admin", label: "Admin" },
                    { value: "Buyer", label: "Buyer" },
                    { value: "Approver", label: "Approver" },
                  ]}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowMembershipModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={!selectedCompanyId} onClick={handleAddMembership}>
                  Assign Role
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
