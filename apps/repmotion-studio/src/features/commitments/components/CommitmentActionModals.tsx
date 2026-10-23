"use client";

import { useState } from "react";
import {
  Button,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader
} from "@/components/ui";
import { accountsDirectory } from "../../accounts/data";
import type { CommitmentCategory, CommitmentItem } from "../types";

interface NewCommitmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newCommitment: CommitmentItem) => void;
}

export function NewCommitmentModal({ isOpen, onClose, onSave }: NewCommitmentModalProps) {
  const accounts = Object.values(accountsDirectory);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "volttech");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<CommitmentCategory>("submittal_spec");
  const [dueDate, setDueDate] = useState("Today · 5:00 PM CST");
  const [dependency, setDependency] = useState("");

  const selectedAccount = accountsDirectory[selectedAccountId] || accounts[0];
  const primaryContact = selectedAccount.contacts.find((c) => c.isPrimary) || selectedAccount.contacts[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newCommitment: CommitmentItem = {
      id: `COM-${Math.floor(100 + Math.random() * 900)}`,
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      industry: selectedAccount.industry,
      title: title.trim(),
      details: details.trim() || undefined,
      category,
      categoryLabel:
        category === "submittal_spec"
          ? "Engineering Submittal"
          : category === "stock_reservation"
          ? "Inventory Reservation"
          : category === "pricing_quote"
          ? "Volume Pricing"
          : category === "logistics_tracking"
          ? "Freight Expedite"
          : category === "billing_credit"
          ? "Credit & Accounting"
          : "Field Sample",
      ownerName: "Maya Chen",
      ownerRole: "Account Executive",
      contact: {
        name: primaryContact.name,
        role: primaryContact.title,
        phone: primaryContact.phone,
        email: primaryContact.email,
        avatarInitials: primaryContact.avatarInitials
      },
      dueDate,
      dueTimestamp: new Date().toISOString(),
      urgency: dueDate.toLowerCase().includes("today") ? "today" : "this_week",
      status: "Open",
      dependency: dependency.trim() || undefined,
      createdAt: "Just now"
    };

    onSave(newCommitment);
    setTitle("");
    setDetails("");
    setDependency("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title="Capture Customer Commitment"
        subtitle="Log a promise, due date, and dependency directly into the shared territory queue."
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4 text-xs">
            {/* Account Selector */}
            <label className="block space-y-1">
              <span className="font-semibold text-foreground">Target Customer Account</span>
              <select
                className="w-full bg-card border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.industry})
                  </option>
                ))}
              </select>
            </label>

            {/* Primary Contact Stamped Card */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                  {primaryContact.avatarInitials}
                </div>
                <div>
                  <span className="font-semibold text-foreground block">{primaryContact.name}</span>
                  <span className="text-[11px] text-muted-foreground">{primaryContact.title}</span>
                </div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <div>{primaryContact.phone}</div>
                <div>{primaryContact.email}</div>
              </div>
            </div>

            {/* Promise Title */}
            <label className="block space-y-1">
              <span className="font-semibold text-foreground">What did you promise the customer? *</span>
              <Input
                placeholder="e.g. Provide certified CAD layout by 3 PM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            {/* Details */}
            <label className="block space-y-1">
              <span className="font-semibold text-foreground">Specific Details or Customer Notes</span>
              <Input
                placeholder="e.g. Inspector arriving Friday morning; need terminal spacing diagram"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Category */}
              <label className="block space-y-1">
                <span className="font-semibold text-foreground">Commitment Type</span>
                <select
                  className="w-full bg-card border border-border text-foreground text-xs rounded-lg px-3 py-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CommitmentCategory)}
                >
                  <option value="submittal_spec">Engineering Submittal / Specs</option>
                  <option value="stock_reservation">Inventory / Warehouse Reservation</option>
                  <option value="pricing_quote">Volume Pricing / Revised Quote</option>
                  <option value="logistics_tracking">Logistics Tracking / Expedite</option>
                  <option value="billing_credit">Credit Memo / Invoice Adjustment</option>
                  <option value="sample_shipment">Product Sample Delivery</option>
                </select>
              </label>

              {/* Due Date */}
              <label className="block space-y-1">
                <span className="font-semibold text-foreground">Committed Due Date & Time</span>
                <Input
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="e.g. Today · 4:00 PM CST"
                  required
                />
              </label>
            </div>

            {/* Dependency */}
            <label className="block space-y-1">
              <span className="font-semibold text-foreground">Upstream Dependency (Optional)</span>
              <Input
                placeholder="e.g. Waiting on Chicago branch stock count or CAD engineer"
                value={dependency}
                onChange={(e) => setDependency(e.target.value)}
              />
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit">
            Save Commitment to Queue
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface RescheduleModalProps {
  item: CommitmentItem | null;
  onClose: () => void;
  onConfirm: (id: string, newDate: string, reason: string) => void;
}

export function RescheduleModal({ item, onClose, onConfirm }: RescheduleModalProps) {
  const [newDate, setNewDate] = useState("Tomorrow · 11:00 AM CST");
  const [reason, setReason] = useState("Awaiting branch stock check-in");

  if (!item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(item.id, newDate, reason);
    onClose();
  };

  return (
    <Modal isOpen={!!item} onClose={onClose} size="md">
      <ModalHeader
        title="Reschedule Commitment"
        subtitle={`Update deadline for ${item.accountName}`}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                Current Commitment
              </span>
              <p className="text-sm font-semibold text-foreground mt-0.5">{item.title}</p>
              <div className="text-xs text-muted-foreground mt-1">Current Due: <strong>{item.dueDate}</strong></div>
            </div>

            <label className="block space-y-1">
              <span className="font-semibold text-foreground">New Committed Date & Time</span>
              <Input
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                placeholder="e.g. Oct 19 · 2:00 PM CST"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="font-semibold text-foreground">Customer Context / Reason</span>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Carrier weather delay, customer meeting postponed"
                required
              />
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit">
            Confirm Rescheduled Deadline
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
