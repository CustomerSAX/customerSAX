"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardMetric,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader
} from "../../components/ui";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@csa/ui/components/data-display/Table";
import { useDemo } from "./demo-state";
import { sources, targets } from "./data";

export function Status({ children }: { children: string }) {
  const variant = [
    "Ready",
    "Current",
    "Complete",
    "Approved",
    "Resolution ready"
  ].includes(children)
    ? "success"
    : ["Review", "Open", "Discovery"].includes(children)
      ? "warning"
      : ["Blocked", "Escalated"].includes(children)
        ? "error"
        : "info";
  return (
    <Badge variant={variant} dot>
      {children}
    </Badge>
  );
}
export function ActionLink({
  href,
  children,
  secondary = false
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`action-link ${secondary ? "secondary" : ""}`} href={href}>
      {children}
      <Icon name="arrow-right" size="sm" />
    </Link>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      <div className="panel-content">{children}</div>
    </Card>
  );
}
export function Metrics({ items }: { items: string[][] }) {
  return (
    <section className="metrics" aria-label="Workspace summary">
      {items.map(([title, value, subtitle], i) => (
        <CardMetric
          key={title}
          title={title}
          value={value}
          subtitle={subtitle}
          icon={
            <Icon
              name={["users", "crosshair", "circle-check", "calendar-days"][i]}
              size="sm"
            />
          }
        />
      ))}
    </section>
  );
}
export function DataTable({
  label,
  columns,
  rows
}: {
  label: string;
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <Table caption={label}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column} scope="col">
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function SourceList({ compact = false }: { compact?: boolean }) {
  const { refreshTime } = useDemo();
  return (
    <div className="rows">
      {sources.slice(0, compact ? 4 : 5).map(([name, description, time, icon]) => (
        <div className="source-row" key={name}>
          <span className="icon-tile">
            <Icon name={icon} size="sm" />
          </span>
          <div className="grow">
            <strong>{name}</strong>
            <p>{compact ? "Sample source is current" : description}</p>
          </div>
          <span className="source-time">
            <Status>Current</Status>
            <small>{refreshTime || time}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
export function CommitmentCapture({
  account = "Summit Commercial Builders",
  label = "Capture new commitment"
}: {
  account?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const demo = useDemo();
  return (
    <>
      <Button leftIcon={<Icon name="plus" size="sm" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalHeader
          title="Capture a customer commitment"
          subtitle="Save a promise, its owner, and a due date to the shared demo workspace."
          onClose={() => setOpen(false)}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const title = String(data.get("title") || "").trim();
            const owner = String(data.get("owner") || "").trim();
            if (!title || !owner) return;
            demo.capture({
              title,
              owner,
              account: String(data.get("account")),
              due: String(data.get("due")).replace("T", " "),
              dependency: String(data.get("dependency") || "").trim() || "None recorded"
            });
            setOpen(false);
          }}
        >
          <ModalBody>
            <label className="field">
              Account
              <select name="account" defaultValue={account}>
                {targets.map((target) => (
                  <option key={target.id}>{target.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Commitment
              <Input
                name="title"
                placeholder="What did you promise the customer?"
                required
                maxLength={180}
                pattern=".*\S.*"
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Owner
                <Input
                  name="owner"
                  defaultValue="Maya Chen"
                  required
                  maxLength={80}
                  pattern=".*\S.*"
                />
              </label>
              <label className="field">
                Due date
                <Input name="due" type="datetime-local" required />
              </label>
            </div>
            <label className="field">
              Dependency
              <Input
                name="dependency"
                placeholder="e.g. Customer scope confirmation"
                maxLength={180}
              />
            </label>
            <p>Saved for this browser session only. No customer message is sent.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save commitment</Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
export function CommitmentTable({ account }: { account?: string }) {
  const { commitments } = useDemo();
  return (
    <DataTable
      label="Customer commitments"
      columns={["Commitment", "Account", "Owner", "Due", "Dependency", "Status"]}
      rows={commitments
        .filter((item) => !account || item.account === account)
        .map((item) => [
          <strong key="title">{item.title}</strong>,
          item.account,
          item.owner,
          item.due,
          item.dependency,
          <Status key="status">{item.status}</Status>
        ])}
    />
  );
}
