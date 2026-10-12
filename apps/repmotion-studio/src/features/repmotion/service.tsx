"use client";

import { useState } from "react";
import { Button, Icon, PageHeader } from "../../components/ui";
import { ActionLink, CommitmentTable, Metrics, Panel, Status } from "./components";
import { cases } from "./data";
import { useDemo } from "./demo-state";

export function Service() {
  const [selected, setSelected] = useState(cases[0]);
  const demo = useDemo();
  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={<span className="eyebrow">CUSTOMER CARE / AVA BROOKS</span>}
        title="Resolve with the full picture."
        subtitle="Customer context, sales promises, and service history. All in one place."
        actions={
          <ActionLink href="/accounts/summit" secondary>
            Open sales brief
          </ActionLink>
        }
      />
      <Metrics
        items={[
          ["My open cases", "12", "3 require customer response"],
          ["High customer impact", "2", "1 linked to today’s sales meeting"],
          ["Due today", "4", "Next commitment at 9:00 AM"],
          ["Shared with sales", "5", "Account owners have current context"]
        ]}
      />
      <div className="service-grid">
        <Panel
          title="My service queue"
          description="Customer impact and commitment timing"
        >
          <div className="queue-list">
            {cases.map((item) => (
              <button
                className={`queue-item ${selected.id === item.id ? "selected" : ""}`}
                key={item.id}
                aria-pressed={selected.id === item.id}
                onClick={() => setSelected(item)}
              >
                <div className="row-between">
                  <strong>{item.account}</strong>
                  <Status>{item.status}</Status>
                </div>
                <p>{item.description}</p>
                <small>
                  {item.id} · {item.due}
                </small>
              </button>
            ))}
          </div>
        </Panel>
        <Panel
          title={selected.title}
          description={selected.context}
          action={<Status>{selected.status}</Status>}
        >
          <span className="eyebrow">CASE {selected.id}</span>
          <section className="recommendation service-recommendation">
            <div className="row-between">
              <span className="eyebrow">
                {selected.ready ? "PREPARED RESOLUTION" : "NEXT SERVICE STEP"}
              </span>
              <Icon name="package-check" size="md" />
            </div>
            <h2>{selected.resolution}</h2>
            <p>{selected.evidence}</p>
            {selected.ready && (
              <>
                <div className="context-metrics">
                  <div>
                    <span>Order</span>
                    <strong>O-10489</strong>
                  </div>
                  <div>
                    <span>Shipment</span>
                    <strong>Allocated</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>Tuesday</strong>
                  </div>
                </div>
                <div className="actions">
                  <Button
                    disabled={demo.resolutionReady}
                    onClick={() => {
                      demo.setResolutionReady(true);
                      demo.notify(
                        "Summit resolution marked ready",
                        "Ava reviewed the confirmed replacement shipment in the demo."
                      );
                    }}
                  >
                    {demo.resolutionReady ? "Resolution ready" : "Mark resolution ready"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!demo.resolutionReady || demo.ownerNotified}
                    onClick={() => {
                      demo.setOwnerNotified(true);
                      demo.notify(
                        "Maya notified in demo",
                        "Summit’s reviewed resolution is now visible in the account brief."
                      );
                    }}
                  >
                    {demo.ownerNotified ? "Maya notified" : "Notify Maya (demo)"}
                  </Button>
                </div>
              </>
            )}
          </section>
          {selected.ready ? (
            <>
              <div className="resolution-steps">
                {[
                  [
                    "Understand the inquiry",
                    "Customer needs a confirmed replacement delivery date.",
                    "Complete"
                  ],
                  [
                    "Retrieve customer context",
                    "Account, order, meeting, and previous promises are attached.",
                    "Complete"
                  ],
                  [
                    "Validate the resolution",
                    "Review the allocated shipment and planned Tuesday delivery.",
                    demo.resolutionReady ? "Complete" : "Review"
                  ],
                  [
                    "Communicate and coordinate",
                    "Record customer notification, then share the result with sales.",
                    demo.customerNotified ? "Complete" : "Review"
                  ],
                  [
                    "Confirm closure",
                    "Customer notification and owner handoff must be recorded.",
                    demo.customerNotified && demo.ownerNotified ? "Complete" : "Waiting"
                  ]
                ].map(([title, description, status]) => (
                  <div className="source-row" key={title}>
                    <div className="grow">
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                    <Status>{status}</Status>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                disabled={!demo.resolutionReady || demo.customerNotified}
                onClick={() => {
                  demo.setCustomerNotified(true);
                  demo.notify(
                    "Customer notification recorded in demo",
                    "No message was sent. The sample service workflow has been updated."
                  );
                }}
              >
                {demo.customerNotified
                  ? "Customer notification recorded"
                  : "Record customer notification (demo)"}
              </Button>
            </>
          ) : (
            <div className="quiet-note">
              <Icon name="clock-3" size="md" />
              <p>
                This case is awaiting the evidence described above. A resolution cannot
                yet be confirmed in this sample.
              </p>
            </div>
          )}
        </Panel>
      </div>
      <Panel
        title="Shared customer commitments"
        description="New sales promises appear here as they are captured"
      >
        <CommitmentTable />
      </Panel>
    </div>
  );
}
