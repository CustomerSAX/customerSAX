"use client";

import { useState, useMemo } from "react";
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
  Label,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@csa/ui";
import { useTicketStore } from "../hooks/use-tickets";
import { useCustomerStore } from "../../customers/hooks/use-customers";
import type {
  TicketCategoryKey,
  TicketContactType,
  TicketPriority,
  WorklogComment,
  TicketAttachment,
} from "../types/ticket-types";

const CONTACT_TYPE_OPTIONS = [
  { value: "Email", label: "Email" },
  { value: "Phone", label: "Phone" },
  { value: "Chat", label: "Chat" },
  { value: "Web", label: "Web Portal" },
  { value: "Social", label: "Social Media" },
];

const CATEGORY_OPTIONS = [
  { value: "order_inquiry", label: "Order Inquiry" },
  { value: "payment_methods", label: "Payment Methods" },
  { value: "returns_refunds", label: "Returns & Refunds" },
  { value: "general_inquiry", label: "General Inquiry" },
  { value: "technical_support", label: "Technical Support" },
  { value: "account_management", label: "Account Management" },
];

const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Urgent", label: "Urgent" },
];

const AGENT_OPTIONS = [
  { value: "John Agent (john.agent@csa.com)", label: "John Agent" },
  { value: "Sarah Jenkins (sarah.jenkins@csa.com)", label: "Sarah Jenkins" },
  { value: "Tech Support Team", label: "Tech Support Team" },
  { value: "Support Desk", label: "Support Desk (Unassigned)" },
];

const ORDER_LINKED_CATEGORIES: TicketCategoryKey[] = [
  "order_inquiry",
  "payment_methods",
  "returns_refunds",
];

export function TicketCreateView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addTicket } = useTicketStore();
  const { customers } = useCustomerStore();

  const prefillEmail = searchParams.get("email") || "";
  const customerIdContext = searchParams.get("customerId") || "";

  const [email, setEmail] = useState(prefillEmail);
  const [customerFound, setCustomerFound] = useState<boolean>(Boolean(prefillEmail));
  const [customerLookupMsg, setCustomerLookupMsg] = useState("");
  const [matchedCustomer, setMatchedCustomer] = useState<any>(
    prefillEmail ? customers.find((c) => c.email.toLowerCase() === prefillEmail.toLowerCase()) || customers[0] : null
  );

  const [contactType, setContactType] = useState<TicketContactType>("Email");
  const [category, setCategory] = useState<TicketCategoryKey>("order_inquiry");
  const [orderNumber, setOrderNumber] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("Medium");
  const [assignedTo, setAssignedTo] = useState(AGENT_OPTIONS[0].value);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [worklogText, setWorklogText] = useState("");
  const [worklogs, setWorklogs] = useState<WorklogComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachmentNameInput, setAttachmentNameInput] = useState("");
  const [attachmentUrlInput, setAttachmentUrlInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const showOrderField = ORDER_LINKED_CATEGORIES.includes(category);

  // Eligible Orders mock calculation
  const eligibleOrders = useMemo(() => {
    return [
      { value: "ORD-54019", label: "ORD-54019 ($342.20 - Processing)" },
      { value: "ORD-53982", label: "ORD-53982 ($128.50 - Delivered)" },
      { value: "ORD-53410", label: "ORD-53410 ($64.00 - Delivered)" },
    ];
  }, []);

  const handleSearchCustomer = () => {
    setCustomerLookupMsg("");
    if (!email.trim()) {
      setCustomerLookupMsg("Please enter a customer email address.");
      setCustomerFound(false);
      setMatchedCustomer(null);
      return;
    }

    const found = customers.find((c) => c.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (found) {
      setMatchedCustomer(found);
      setCustomerFound(true);
      setCustomerLookupMsg("Customer record verified.");
    } else {
      setMatchedCustomer(null);
      setCustomerFound(false);
      setCustomerLookupMsg("No customer found for this email address. Please check spelling.");
    }
  };

  const handleAddWorklog = () => {
    if (!worklogText.trim()) return;
    const newWorklog: WorklogComment = {
      id: `wl-${Date.now()}`,
      comment: worklogText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "Pending submit",
      author: "Current Agent",
    };
    setWorklogs((prev) => [...prev, newWorklog]);
    setWorklogText("");
  };

  const handleAddAttachment = () => {
    if (!attachmentNameInput.trim() || !attachmentUrlInput.trim()) return;
    setAttachments((prev) => [
      ...prev,
      {
        name: attachmentNameInput.trim(),
        url: attachmentUrlInput.trim(),
        size: "Attachment",
      },
    ]);
    setAttachmentNameInput("");
    setAttachmentUrlInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Customer email is required";
    }
    if (!subject.trim()) {
      newErrors.subject = "Subject is required";
    }
    if (!message.trim()) {
      newErrors.message = "Message description is required";
    }
    if (showOrderField && !orderNumber) {
      newErrors.orderNumber = "Order selection is required for this ticket category";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
    const created = await addTicket({
      email,
      customerId: matchedCustomer?.id || customerIdContext || undefined,
      contactType,
      category,
      orderNumber: showOrderField ? orderNumber : undefined,
      priority,
      status: "Open",
      assignedTo,
      createdBy: "Current Agent (you)",
      subject,
      message,
      attachments,
      comments: worklogs,
    });
    setIsSubmitting(false);
    const returnRoute = customerIdContext ? `/customers/${customerIdContext}?tab=tickets` : `/tickets/${created.id}`;
    router.push(returnRoute);
    } catch (error) {
      setIsSubmitting(false);
      setErrors({ submit: error instanceof Error ? error.message : "Unable to create ticket" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href={customerIdContext ? `/customers/${customerIdContext}` : "/tickets"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          {customerIdContext ? "Back to Customer 360" : "Back to Tickets Directory"}
        </Link>
        <PageHeader
          title="Create Support Ticket"
          subtitle="Capture customer issue, priority, ownership, order association, and attachments."
          badge={<Badge variant="primary">Helpdesk & Support</Badge>}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.submit && <div className="p-3 rounded-md bg-m-error-surface text-m-error text-xs font-semibold">{errors.submit}</div>}
        {/* Customer Search & Verification */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Customer Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <FormField error={errors.email}>
                  <Label required>Customer Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setCustomerFound(false);
                      clearError("email");
                    }}
                    placeholder="e.g. mia.johnson@example.com"
                  />
                </FormField>
              </div>
              <Button type="button" variant="secondary" size="md" onClick={handleSearchCustomer}>
                Search Customer
              </Button>
            </div>

            {customerLookupMsg && (
              <p
                className={`text-xs font-semibold ${
                  customerFound ? "text-m-success" : "text-m-danger"
                }`}
              >
                {customerLookupMsg}
              </p>
            )}

            {matchedCustomer && (
              <div className="p-3 bg-m-bg-surface border border-m-border rounded-md grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-m-text-muted block">First Name</span>
                  <span className="font-semibold text-m-text">{matchedCustomer.firstName || "Mia"}</span>
                </div>
                <div>
                  <span className="text-m-text-muted block">Last Name</span>
                  <span className="font-semibold text-m-text">{matchedCustomer.lastName || "Johnson"}</span>
                </div>
                <div>
                  <span className="text-m-text-muted block">Company</span>
                  <span className="font-semibold text-m-text">{matchedCustomer.companyName || "Northwind Retail"}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Details & Categorization */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Ticket Details & Categorization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField>
                <Label required>Contact Type</Label>
                <Select
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value as any)}
                  options={CONTACT_TYPE_OPTIONS}
                />
              </FormField>

              <FormField>
                <Label required>Ticket Category</Label>
                <Select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as any);
                    if (!ORDER_LINKED_CATEGORIES.includes(e.target.value as TicketCategoryKey)) {
                      clearError("orderNumber");
                    }
                  }}
                  options={CATEGORY_OPTIONS}
                />
              </FormField>
            </div>

            {showOrderField && (
              <FormField error={errors.orderNumber}>
                <Label required>Associated Order</Label>
                <Select
                  value={orderNumber}
                  onChange={(e) => {
                    setOrderNumber(e.target.value);
                    clearError("orderNumber");
                  }}
                  options={[{ value: "", label: "-- Select Customer Order --" }, ...eligibleOrders]}
                />
              </FormField>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField>
                <Label required>Priority</Label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  options={PRIORITY_OPTIONS}
                />
              </FormField>

              <FormField>
                <Label>Assign To Agent</Label>
                <Select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  options={AGENT_OPTIONS}
                />
              </FormField>
            </div>

            <FormField error={errors.subject}>
              <Label required>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  clearError("subject");
                }}
                placeholder="Brief summary of customer inquiry or issue..."
              />
            </FormField>

            <FormField error={errors.message}>
              <Label required>Issue Description / Message</Label>
              <textarea
                className="w-full p-3 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                rows={4}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  clearError("message");
                }}
                placeholder="Detailed description of customer complaint or inquiry..."
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Worklog & Attachments */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Worklog & Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Worklog */}
            <div className="space-y-2">
              <Label>Initial Worklog Note</Label>
              <div className="flex flex-col sm:flex-row items-end gap-2">
                <Input
                  value={worklogText}
                  onChange={(e) => setWorklogText(e.target.value)}
                  placeholder="Internal note for triage or initial action taken..."
                />
                <Button type="button" variant="secondary" size="md" onClick={handleAddWorklog}>
                  Add Worklog
                </Button>
              </div>

              {worklogs.length > 0 && (
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comment</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {worklogs.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium text-m-text">{w.comment}</TableCell>
                        <TableCell className="text-xs text-m-text-muted">{w.createdAt}</TableCell>
                        <TableCell>
                          <Badge variant="neutral" size="sm">{w.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Attachments */}
            <div className="space-y-2 pt-3 border-t border-m-border">
              <Label>Attach Files / Links</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={attachmentNameInput}
                  onChange={(e) => setAttachmentNameInput(e.target.value)}
                  placeholder="File name (e.g. Invoice.pdf)"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={attachmentUrlInput}
                    onChange={(e) => setAttachmentUrlInput(e.target.value)}
                    placeholder="URL (https://...)"
                  />
                  <Button type="button" variant="secondary" size="md" onClick={handleAddAttachment}>
                    Attach
                  </Button>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {attachments.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-m-bg-surface border border-m-border rounded-md text-xs font-semibold text-m-primary"
                    >
                      📎 {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => router.push(customerIdContext ? `/customers/${customerIdContext}` : "/tickets")}
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
            Create Ticket
          </Button>
        </div>
      </form>
    </div>
  );
}
