"use client";

import { useSyncExternalStore } from "react";
import {
  Button,
  Icon,
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "../../components/ui";
import {
  ActionLink,
  CommitmentCapture,
  CommitmentTable,
  DataTable,
  Metrics,
  Panel,
  Status
} from "./components";
import { conversation, orders } from "./data";
import { useDemo } from "./demo-state";

const sections = ["brief", "business", "service", "commitments"];
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function snapshot() {
  const hash = window.location.hash.slice(1);
  const normalized =
    hash === "opportunities" ? "business" : hash === "history" ? "service" : hash;
  return sections.includes(normalized) ? normalized : "brief";
}
export function Account() {
  const demo = useDemo();
  const tab = useSyncExternalStore(subscribe, snapshot, () => "brief");
  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={<span className="eyebrow">ACCOUNTS / MEETING BRIEF</span>}
        title="Summit Commercial Builders"
        subtitle="Chicago metro · Owned by Maya Chen · Fictional account"
        badge={<Status>Ready</Status>}
        actions={
          <ActionLink href="/today" secondary>
            Today’s targets
          </ActionLink>
        }
      />
      <Metrics
        items={[
          ["Rolling 12-month spend", "$1.84M", "Customer relationship"],
          ["Open quotes", "$126K", "Active commercial context"],
          ["Open orders", "4", "Fulfillment in progress"],
          ["Account health", "72 / 100", "Illustrative account score"]
        ]}
      />
      <div className="insight-strip">
        <span className="icon-tile">
          <Icon name="calendar-days" size="md" />
        </span>
        <div className="grow">
          <strong>Today, 2:30 PM · Jordan Lee</strong>
          <p>
            Confirm project demand, review Q-18719, and close the loop on the replacement
            shipment.
          </p>
        </div>
        <Button
          disabled={demo.approved}
          onClick={demo.approve}
          leftIcon={<Icon name="check" size="sm" />}
        >
          {demo.approved ? "Plan approved" : "Approve conversation plan"}
        </Button>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          window.location.hash = value;
        }}
      >
        <TabsList>
          <TabsTrigger value="brief">Meeting brief</TabsTrigger>
          <TabsTrigger value="business">Orders and opportunities</TabsTrigger>
          <TabsTrigger value="service">Service and history</TabsTrigger>
          <TabsTrigger value="commitments">Commitments</TabsTrigger>
        </TabsList>
        <TabsContent value="brief">
          <div className="content-grid">
            <div className="page-stack">
              <section className="recommendation">
                <div className="row-between">
                  <span className="eyebrow">
                    <Icon name="sparkles" size="sm" /> RECOMMENDED CONVERSATION
                  </span>
                  <Status>{demo.approved ? "Approved" : "Review"}</Status>
                </div>
                <h2>
                  Confirm demand now. Align the next order with their project timing.
                </h2>
                <p>
                  Summit has historically reordered concrete accessories about every 90
                  days. The last order was 78 days ago and fulfillment lead time is about
                  14 days. Use this pattern to ask about demand, not assume it.
                </p>
                <div className="context-metrics">
                  {[
                    ["Observed cycle", "About 90 days"],
                    ["Since last order", "78 days"],
                    ["Current lead time", "About 14 days"]
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="actions">
                  <Button onClick={demo.approve} disabled={demo.approved}>
                    {demo.approved ? "Plan approved" : "Approve plan"}
                  </Button>
                  <CommitmentCapture label="Capture meeting result" />
                </div>
              </section>
              <Panel
                title="Conversation plan"
                description="Prepared from account history and current business facts"
                action={<Status>Evidence attached</Status>}
              >
                <dl className="detail-list">
                  {conversation.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
            <aside className="page-stack">
              <Panel
                title="Evidence used"
                description="Sample records and latest refresh"
              >
                <div className="rows">
                  {[
                    ["Order O-10248", "Concrete accessories · 78 days ago", "8:04"],
                    ["Quote Q-18719", "$84,600 · valid through Oct 10", "8:02"],
                    ["Lead-time view", "Current estimate about 14 days", "8:05"],
                    ["Service case CS-4408", "Replacement shipment confirmed", "7:28"],
                    ["Last meeting note", "Project-pricing follow-up requested", "Sep 18"]
                  ].map(([title, description, time]) => (
                    <div className="source-row" key={title}>
                      <span className="icon-tile">
                        <Icon name="file-text" size="sm" />
                      </span>
                      <div className="grow">
                        <strong>{title}</strong>
                        <p>{description}</p>
                      </div>
                      <small>{time}</small>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Key people" description="Relationship context">
                <div className="rows">
                  {[
                    ["JL", "Jordan Lee", "Purchasing Director · decision maker"],
                    ["AS", "Alex Soto", "Project Superintendent"],
                    ["AB", "Ava Brooks", "Customer care owner"]
                  ].map(([initials, name, role]) => (
                    <div className="person contact" key={name}>
                      <span className="avatar">{initials}</span>
                      <div>
                        <strong>{name}</strong>
                        <small>{role}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              <div className="quiet-note">
                <Icon name="info" size="md" />
                <p>
                  Current customer inventory is unknown. Validate need and quantities
                  during the conversation.
                </p>
              </div>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="business">
          <Panel
            title="Orders and opportunities"
            description="Current sample business with Summit"
          >
            <DataTable
              label="Summit orders and opportunities"
              columns={[
                "Record",
                "Type",
                "Value",
                "Current position",
                "Next business step"
              ]}
              rows={orders.map((row) =>
                row.map((value, i) =>
                  i === 3 ? <Status key={value}>{value}</Status> : value
                )
              )}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="service">
          <div className="content-grid">
            <Panel
              title="Service context"
              description="Customer-impacting history relevant to this meeting"
            >
              <dl className="detail-list">
                <div>
                  <dt>Resolved today</dt>
                  <dd>
                    CS-4408: Replacement shipment confirmed for Tuesday. Customer care
                    recorded the update at 7:28 AM.
                  </dd>
                </div>
                <div>
                  <dt>Customer sentiment</dt>
                  <dd>
                    Jordan thanked the team and asked for more reliable delivery
                    visibility on the next order.
                  </dd>
                </div>
                <div>
                  <dt>Sales implication</dt>
                  <dd>
                    Acknowledge the issue and confirm the resolution. Validate any new
                    delivery promise before sharing it.
                  </dd>
                </div>
                {demo.ownerNotified && (
                  <div>
                    <dt>Latest demo update</dt>
                    <dd>Ava shared the reviewed resolution with Maya.</dd>
                  </div>
                )}
              </dl>
            </Panel>
            <section className="meeting-card">
              <span className="eyebrow">CROSS-ROLE HANDOFF</span>
              <h2>One customer. A connected team.</h2>
              <p>
                Maya sees the service context before her meeting. Ava sees every new sales
                commitment.
              </p>
              <ActionLink href="/service">Open customer care</ActionLink>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="commitments">
          <Panel
            title="Customer commitments"
            description="Promises, owners, due dates, and dependencies"
            action={<CommitmentCapture />}
          >
            <CommitmentTable account="Summit Commercial Builders" />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
