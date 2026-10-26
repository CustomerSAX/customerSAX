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
} from "@csa/ui";
import { useDemo } from "./demo-state";
import { sources, targets } from "./data";
import { accountsDirectory } from "../accounts/data";

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
                {Object.values(accountsDirectory).map((acc) => (
                  <option key={acc.id} value={acc.name}>
                    {acc.name}
                  </option>
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
  const { commitments, updateCommitmentStatus } = useDemo();
  return (
    <DataTable
      label="Customer commitments"
      columns={["Commitment", "Account", "Owner", "Due", "Dependency", "Status", "Quick Action"]}
      rows={commitments
        .filter((item) => !account || item.account === account)
        .map((item) => [
          <strong key="title" className="text-foreground">{item.title}</strong>,
          <span key="account" className="font-medium">{item.account}</span>,
          item.owner,
          item.due,
          item.dependency,
          <Badge
            key="status"
            variant={
              item.status === "Fulfilled" || item.status === "Complete"
                ? "success"
                : item.status === "In Progress"
                ? "primary"
                : item.status === "Blocked"
                ? "error"
                : "warning"
            }
            dot
          >
            {item.status}
          </Badge>,
          <div key="action" className="flex items-center gap-1.5">
            {item.status !== "Fulfilled" && item.status !== "Complete" ? (
              <Button
                size="sm"
                variant="secondary"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-[11px] py-1 px-2.5 h-auto font-medium"
                onClick={() => updateCommitmentStatus(item.id, "Fulfilled")}
                leftIcon={<Icon name="check" size="xs" />}
              >
                Mark Fulfilled
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="text-muted-foreground text-[11px] py-1 px-2 h-auto"
                onClick={() => updateCommitmentStatus(item.id, "Open")}
                leftIcon={<Icon name="rotate-ccw" size="xs" />}
              >
                Reopen
              </Button>
            )}
          </div>
        ])}
    />
  );
}
