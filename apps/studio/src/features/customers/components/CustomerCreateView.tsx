"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Label,
} from "@csa/ui";
import { useCustomerStore } from "../hooks/use-customers";

export function CustomerCreateView() {
  const router = useRouter();
  const { groups, addCustomer } = useCustomerStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [groupId, setGroupId] = useState("grp-retail");
  const [externalId, setExternalId] = useState("");

  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!email.includes("@")) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const selectedGroup = groups.find((g) => g.id === groupId);

    const created = addCustomer({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      companyName: companyName || undefined,
      customerNumber: `CN-${Math.floor(10000 + Math.random() * 90000)}`,
      externalId: externalId || undefined,
      customerGroup: selectedGroup ? { id: selectedGroup.id, name: selectedGroup.name, key: selectedGroup.key } : undefined,
      addresses: streetName || city
        ? [
            {
              id: `addr-${Date.now()}`,
              streetName,
              streetNumber,
              city,
              state,
              postalCode,
              country,
              email,
              phone,
              isShipping: true,
              isBilling: true,
              isDefaultShipping: true,
              isDefaultBilling: true,
            },
          ]
        : [],
    });

    setTimeout(() => {
      setIsSubmitting(false);
      router.push(`/customers/${created.id}`);
    }, 300);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to Customer Directory
        </Link>
        <PageHeader
          title="Create New Customer"
          subtitle="Register a new customer profile with personal, company, and primary address details."
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField error={errors.firstName}>
              <Label required>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Jane"
              />
            </FormField>

            <FormField error={errors.lastName}>
              <Label required>Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Doe"
              />
            </FormField>

            <FormField error={errors.email}>
              <Label required>Primary Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@example.com"
              />
            </FormField>

            <FormField>
              <Label>Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Company & Group */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Company & Account Group</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField>
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
              />
            </FormField>

            <FormField>
              <Label>Customer Group</Label>
              <Select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                options={groupOptions}
              />
            </FormField>

            <FormField>
              <Label>External ID</Label>
              <Input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="ERP / CRM ID"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Default Address */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Default Address (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField>
                <Label>Street Name</Label>
                <Input
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  placeholder="Main St"
                />
              </FormField>
              <FormField>
                <Label>Street Number</Label>
                <Input
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                  placeholder="100"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField>
                <Label>City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Springfield"
                />
              </FormField>
              <FormField>
                <Label>State / Region</Label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="OR"
                />
              </FormField>
              <FormField>
                <Label>Postal Code</Label>
                <Input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="97477"
                />
              </FormField>
              <FormField>
                <Label>Country</Label>
                <Select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  options={[
                    { value: "US", label: "United States" },
                    { value: "CA", label: "Canada" },
                    { value: "GB", label: "United Kingdom" },
                    { value: "DE", label: "Germany" },
                    { value: "FR", label: "France" },
                  ]}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => router.push("/customers")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSubmitting}
            leftIcon={<Icon name="check" size="xs" />}
          >
            Create Customer
          </Button>
        </div>
      </form>
    </div>
  );
}
