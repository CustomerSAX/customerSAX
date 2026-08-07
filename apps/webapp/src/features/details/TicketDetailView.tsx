"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  TextArea,
  Select,
  Avatar,
  Icon,
  FormField
} from "@csa/ui";

interface TicketDetailViewProps {
  id: string;
}

export function TicketDetailView({ id }: TicketDetailViewProps) {
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("high");
  const [assignee, setAssignee] = useState("a-kumar");
  const [replyMessage, setReplyMessage] = useState("");

  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "Mia Johnson",
      role: "Customer",
      avatar: "Mia Johnson",
      time: "Aug 06, 2026 14:22",
      content:
        "Hello support team, my order ORD-54019 payment was captured 2 hours ago, but the order status is still showing as Processing and no shipping tracking number was assigned. Could you please check?"
    },
    {
      id: "2",
      sender: "A. Kumar",
      role: "Support Agent",
      avatar: "A Kumar",
      isAgent: true,
      time: "Aug 06, 2026 14:35",
      content:
        "Hi Mia, I have checked with our fulfillment center. The payment is successfully captured and stock is allocated. It is scheduled to ship today via FedEx Express. I will update you with tracking details shortly."
    }
  ]);

  const handleSendReply = () => {
    if (!replyMessage.trim()) return;
    setMessages([
      ...messages,
      {
        id: String(Date.now()),
        sender: "A. Kumar",
        role: "Support Agent",
        avatar: "A Kumar",
        isAgent: true,
        time: "Just now",
        content: replyMessage
      }
    ]);
    setReplyMessage("");
  };

  return (
    <div className="space-y-6">
      {/* Back link & Header */}
      <div>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to Tickets
        </Link>

        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <span>Order delayed after payment capture</span>
              <Badge variant="primary" appearance="outline" size="md">
                {id}
              </Badge>
            </div>
          }
          subtitle="Ticket opened via Phone support • Customer Mia Johnson (cst-1001)"
          badge={
            <Badge variant="error" appearance="subtle" size="md" dot>
              High Priority
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" leftIcon={<Icon name="printer" size="xs" />}>
                Print
              </Button>
              <Button variant="danger" size="md" leftIcon={<Icon name="check-circle" size="xs" />}>
                Resolve Ticket
              </Button>
            </div>
          }
        />
      </div>

      {/* Grid Layout: Main Conversation Feed + Sidebar Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Column: Messages & Reply Box */}
        <div className="space-y-6">
          {/* Conversation Feed */}
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border flex items-center justify-between">
              <CardTitle className="text-xs">Conversation Timeline ({messages.length} messages)</CardTitle>
              <Badge variant="neutral" size="sm">
                SLA: 4 hrs remaining
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 p-4 rounded-m-xl border ${
                    msg.isAgent
                      ? "bg-m-primary-50/50 border-m-primary-100"
                      : "bg-m-surface-2/60 border-m-border"
                  }`}
                >
                  <Avatar name={msg.avatar} size="md" status={msg.isAgent ? "online" : "offline"} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-m-text">{msg.sender}</span>
                        <Badge variant={msg.isAgent ? "primary" : "neutral"} size="sm">
                          {msg.role}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-m-text-muted">{msg.time}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-m-text pt-1">{msg.content}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Reply Editor */}
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Send Response to Customer</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <TextArea
                placeholder="Type your response or internal note..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                resize="vertical"
              />
              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" leftIcon={<Icon name="paperclip" size="xs" />}>
                  Attach file
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSendReply}
                  leftIcon={<Icon name="send" size="xs" />}
                >
                  Send Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket Properties & Metadata */}
        <aside className="space-y-6">
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Ticket Properties</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <FormField label="Status">
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={[
                    { value: "open", label: "Open" },
                    { value: "in-progress", label: "In Progress" },
                    { value: "waiting", label: "Waiting on Customer" },
                    { value: "resolved", label: "Resolved" }
                  ]}
                />
              </FormField>

              <FormField label="Priority">
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  options={[
                    { value: "high", label: "High" },
                    { value: "normal", label: "Normal" },
                    { value: "low", label: "Low" }
                  ]}
                />
              </FormField>

              <FormField label="Assignee">
                <Select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  options={[
                    { value: "a-kumar", label: "A. Kumar (You)" },
                    { value: "s-patel", label: "S. Patel" },
                    { value: "queue", label: "Unassigned Queue" }
                  ]}
                />
              </FormField>

              <div className="pt-2 border-t border-m-border space-y-2">
                <span className="text-xs font-semibold text-m-text">Associated Customer</span>
                <div className="p-3 rounded-m-lg border border-m-border bg-m-surface-2 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-m-text">Mia Johnson</span>
                    <span className="text-[11px] text-m-text-muted">mia@example.com</span>
                  </div>
                  <Link href="/customers/cst-1001">
                    <Button variant="outline" size="sm" iconOnly leftIcon={<Icon name="external-link" size="xs" />} aria-label="View Customer" />
                  </Link>
                </div>
              </div>

              <div className="pt-2 border-t border-m-border space-y-2">
                <span className="text-xs font-semibold text-m-text">Associated Order</span>
                <div className="p-3 rounded-m-lg border border-m-border bg-m-surface-2 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-m-primary">ORD-54019</span>
                    <span className="text-[11px] text-m-text-muted">Total: $342.20</span>
                  </div>
                  <Link href="/orders/ORD-54019">
                    <Button variant="outline" size="sm" iconOnly leftIcon={<Icon name="external-link" size="xs" />} aria-label="View Order" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
