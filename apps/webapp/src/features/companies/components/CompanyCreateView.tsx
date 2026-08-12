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
  Modal,
  ModalHeader,
  ModalBody,
  Badge,
} from "@csa/ui";
import { useCompanies } from "../hooks/use-companies";
import type { CompanyUnitType, CompanyAddress, CompanyAssociate } from "../types/company-types";

type Step = 1 | 2 | 3;

const UNIT_TYPES = [
  { value: "Company", label: "Company" },
  { value: "Division", label: "Division" },
];

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "AU", label: "Australia" },
];

const ROLES = [
  { value: "Admin", label: "Admin" },
  { value: "Buyer", label: "Buyer" },
  { value: "Approver", label: "Approver" },
];

export function CompanyCreateView() {
  const router = useRouter();
  const { allCompanies, createCompany } = useCompanies();

  const [step, setStep] = useState<Step>(1);

  // Step 1 values
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [unitType, setUnitType] = useState<CompanyUnitType>("Company");
  const [parentId, setParentId] = useState("");

  // Step 2 values (Addresses)
  const [addresses, setAddresses] = useState<CompanyAddress[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");

  // Step 3 values (Associates)
  const [associates, setAssociates] = useState<CompanyAssociate[]>([]);
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [assocName, setAssocName] = useState("");
  const [assocEmail, setAssocEmail] = useState("");
  const [assocRole, setAssocRole] = useState("Buyer");

  const parentOptions = [
    { value: "", label: "Select parent company (optional)" },
    ...allCompanies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleAddAddress = () => {
    if (!street || !city || !postalCode) return;
    const newAddr: CompanyAddress = {
      id: `addr-new-${Date.now()}`,
      streetName: street,
      city,
      state,
      postalCode,
      country,
    };
    setAddresses((prev) => [...prev, newAddr]);
    setStreet("");
    setCity("");
    setState("");
    setPostalCode("");
    setShowAddressModal(false);
  };

  const handleAddAssociate = () => {
    if (!assocName || !assocEmail) return;
    const newAssoc: CompanyAssociate = {
      id: `assoc-new-${Date.now()}`,
      customerId: `cst-new-${Date.now()}`,
      name: assocName,
      email: assocEmail,
      roles: [assocRole],
      status: "Active",
    };
    setAssociates((prev) => [...prev, newAssoc]);
    setAssocName("");
    setAssocEmail("");
    setShowAssociateModal(false);
  };

  const handleSave = () => {
    if (!name || !key) return;
    const parentComp = allCompanies.find((c) => c.id === parentId);
    const created = createCompany({
      name,
      key,
      unitType,
      parentId: parentId || undefined,
      parentName: parentComp?.name,
      status: "Active",
      addresses,
      associates,
    });
    router.push(`/b2b/company/${created.id}`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Create Company"
        subtitle="Set up a new B2B business unit, addresses, and associate members."
        breadcrumbs={
          <div className="flex items-center gap-1 text-xs text-m-text-muted">
            <button onClick={() => router.push("/b2b/company")} className="hover:text-m-primary">
              Companies
            </button>
            <span>/</span>
            <span>Create</span>
          </div>
        }
        actions={
          <Button variant="secondary" size="md" onClick={() => router.push("/b2b/company")}>
            Cancel
          </Button>
        }
      />

      {/* Stepper */}
      <div className="flex items-center justify-between border-b border-m-border pb-4">
        {[
          { num: 1, label: "Company Details" },
          { num: 2, label: "Addresses" },
          { num: 3, label: "Employees" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                step === s.num
                  ? "bg-m-primary text-white"
                  : step > s.num
                  ? "bg-m-success text-white"
                  : "bg-m-surface-2 text-m-text-muted"
              }`}
            >
              {step > s.num ? "✓" : s.num}
            </div>
            <span
              className={`text-sm font-semibold ${
                step === s.num ? "text-m-text" : "text-m-text-muted"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Company Details */}
      {step === 1 && (
        <Panel title="Step 1: Company Information">
          <div className="flex flex-col gap-4 p-5">
            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">
                Company Name <span className="text-m-danger">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Industrial Solutions"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">
                Company Key <span className="text-m-danger">*</span>
              </label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. acme-industrial"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-m-text mb-1 block">Unit Type</label>
              <Select
                value={unitType}
                options={UNIT_TYPES}
                onChange={(e) => setUnitType(e.target.value as CompanyUnitType)}
              />
            </div>

            {unitType === "Division" && (
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Parent Company</label>
                <Select
                  value={parentId}
                  options={parentOptions}
                  onChange={(e) => setParentId(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-m-border">
              <Button
                variant="primary"
                size="md"
                disabled={!name.trim() || !key.trim()}
                onClick={() => setStep(2)}
              >
                Next: Addresses
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {/* Step 2: Addresses */}
      {step === 2 && (
        <Panel
          title="Step 2: Company Addresses"
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
          <div className="flex flex-col gap-4 p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Street</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Postal Code</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addresses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-m-text-muted">
                      No addresses added yet. Click &quot;Add Address&quot; above to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  addresses.map((addr) => (
                    <TableRow key={addr.id}>
                      <TableCell>{addr.streetName}</TableCell>
                      <TableCell>{addr.city}</TableCell>
                      <TableCell>{addr.state || "--"}</TableCell>
                      <TableCell>{addr.postalCode}</TableCell>
                      <TableCell>{addr.country}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          leftIcon={<Icon name="trash-2" size="xs" />}
                          onClick={() => setAddresses((prev) => prev.filter((a) => a.id !== addr.id))}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex justify-between gap-3 mt-4 pt-4 border-t border-m-border">
              <Button variant="secondary" size="md" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" size="md" onClick={() => setStep(3)}>
                Next: Employees
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {/* Step 3: Employees */}
      {step === 3 && (
        <Panel
          title="Step 3: Associated Employees"
          headerActions={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() => setShowAssociateModal(true)}
            >
              Add Associate
            </Button>
          }
        >
          <div className="flex flex-col gap-4 p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {associates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-m-text-muted">
                      No associates assigned yet. Click &quot;Add Associate&quot; to assign members.
                    </TableCell>
                  </TableRow>
                ) : (
                  associates.map((assoc) => (
                    <TableRow key={assoc.id}>
                      <TableCell className="font-semibold">{assoc.name}</TableCell>
                      <TableCell>{assoc.email}</TableCell>
                      <TableCell>
                        <Badge variant="primary" size="sm">
                          {assoc.roles.join(", ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          leftIcon={<Icon name="trash-2" size="xs" />}
                          onClick={() => setAssociates((prev) => prev.filter((a) => a.id !== assoc.id))}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex justify-between gap-3 mt-4 pt-4 border-t border-m-border">
              <Button variant="secondary" size="md" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button variant="primary" size="md" onClick={handleSave}>
                Save &amp; Create Company
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {/* Modal: Add Address */}
      {showAddressModal && (
        <Modal isOpen={showAddressModal} onClose={() => setShowAddressModal(false)}>
          <ModalHeader title="Add Address" onClose={() => setShowAddressModal(false)} />
          <ModalBody>
            <div className="flex flex-col gap-4 p-2">
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Street Address</label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g. 100 Market St" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. San Francisco" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">State / Region</label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. CA" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Postal Code</label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="e.g. 94105" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-m-text mb-1 block">Country</label>
                  <Select value={country} options={COUNTRIES} onChange={(e) => setCountry(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowAddressModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleAddAddress}>
                  Add Address
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Modal: Add Associate */}
      {showAssociateModal && (
        <Modal isOpen={showAssociateModal} onClose={() => setShowAssociateModal(false)}>
          <ModalHeader title="Add Associate" onClose={() => setShowAssociateModal(false)} />
          <ModalBody>
            <div className="flex flex-col gap-4 p-2">
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Employee Name</label>
                <Input value={assocName} onChange={(e) => setAssocName(e.target.value)} placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Employee Email</label>
                <Input value={assocEmail} onChange={(e) => setAssocEmail(e.target.value)} placeholder="e.g. jane@company.com" />
              </div>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Role</label>
                <Select value={assocRole} options={ROLES} onChange={(e) => setAssocRole(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowAssociateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleAddAssociate}>
                  Add Associate
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
