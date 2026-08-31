"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Input,
  Select,
} from "@csa/ui";
import { useEmployees } from "../hooks/use-employees";
import { useCompanies } from "@/features/companies/hooks/use-companies";

const GROUPS = [
  { value: "", label: "Select Customer Group" },
  { value: "B2B Buyers", label: "B2B Buyers" },
  { value: "B2B Approvers", label: "B2B Approvers" },
  { value: "B2B VIP", label: "B2B VIP" },
];

const ROLES = [
  { value: "Buyer", label: "Buyer" },
  { value: "Admin", label: "Admin" },
  { value: "Approver", label: "Approver" },
];

export function EmployeeCreateView() {
  const router = useRouter();
  const { createEmployee } = useEmployees();
  const { allCompanies, loading: companiesLoading } = useCompanies();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [customerGroup, setCustomerGroup] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("Buyer");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const companyOptions = [
    { value: "", label: "Select Company / Business Unit" },
    ...allCompanies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const canSave =
    !isSaving &&
    !companiesLoading &&
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    Boolean(email.trim()) &&
    Boolean(password) &&
    password === confirmPassword &&
    Boolean(companyId);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !companyId) {
      setSaveError("Complete all required fields before creating the employee.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setSaveError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setSaveError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setSaveError("Password and confirmation do not match.");
      return;
    }

    const selectedComp = allCompanies.find((c) => c.id === companyId);
    if (!selectedComp) {
      setSaveError("Select a valid company or business unit.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const created = await createEmployee({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth,
        customerGroup: customerGroup || undefined,
        password,
        status: "Active",
        memberships: [{
          companyId: selectedComp.id,
          companyName: selectedComp.name,
          companyKey: selectedComp.key,
          roles: [role],
        }],
        addresses: [],
      });
      router.push(`/b2b/employees/${created.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Employee creation failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Add Employee"
        subtitle="Create a new employee account and assign B2B company associate roles."
        breadcrumbs={
          <div className="flex items-center gap-1 text-xs text-m-text-muted">
            <button onClick={() => router.push("/b2b/employees")} className="hover:text-m-primary">
              Employees
            </button>
            <span>/</span>
            <span>Create</span>
          </div>
        }
        actions={
          <Button variant="secondary" size="md" onClick={() => router.push("/b2b/employees")}>
            Cancel
          </Button>
        }
      />

      {/* Section 1: Employee Information */}
      <Panel title="1. Employee Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              First Name <span className="text-m-danger">*</span>
            </label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Jane" />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">Middle Name</label>
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              Last Name <span className="text-m-danger">*</span>
            </label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Doe" />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              Email Address <span className="text-m-danger">*</span>
            </label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="jane@company.com" />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">Phone Number</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">Date of Birth</label>
            <Input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} type="date" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-m-text mb-1 block">Customer Group</label>
            <Select value={customerGroup} options={GROUPS} onChange={(e) => setCustomerGroup(e.target.value)} />
          </div>
        </div>
      </Panel>

      {/* Section 2: Account Details */}
      <Panel title="2. Account Authentication">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              Password <span className="text-m-danger">*</span>
            </label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="At least 8 characters" />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">
              Confirm Password <span className="text-m-danger">*</span>
            </label>
            <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Re-enter password" />
          </div>
        </div>
      </Panel>

      {/* Section 3: Company Information */}
      <Panel title="3. Company Membership">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">Company / Business Unit</label>
            <Select
              value={companyId}
              options={companyOptions}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={companiesLoading}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-m-text mb-1 block">Associate Role</label>
            <Select value={role} options={ROLES} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>
      </Panel>

      {/* Form Action Footer */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" size="md" onClick={() => router.push("/b2b/employees")}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          loading={isSaving}
          disabled={!canSave}
          onClick={handleSave}
        >
          {companiesLoading ? "Loading Companies..." : "Save & Create Employee"}
        </Button>
      </div>
      {saveError && (
        <div role="alert" className="rounded-md border border-m-danger/30 bg-m-danger/10 px-3 py-2 text-sm text-m-danger">
          {saveError}
        </div>
      )}
    </div>
  );
}
