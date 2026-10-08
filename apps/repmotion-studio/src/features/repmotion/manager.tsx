"use client";

import { Badge, Button, Icon, PageHeader, Switch } from "../../components/ui";
import {
  ActionLink,
  CommitmentTable,
  DataTable,
  Metrics,
  Panel,
  SourceList
} from "./components";
import { controls, measures, team } from "./data";
import { useDemo } from "./demo-state";

export function Manager() {
  const demo = useDemo();
  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={<span className="eyebrow">BACK OFFICE / DAVID KIM</span>}
        title="A clear view of the work ahead."
        subtitle="See what’s ready, what’s blocked, and what customers were promised."
        actions={<ActionLink href="/today">Open rep workspace</ActionLink>}
      />
      <Metrics
        items={[
          ["Ready actions", "23", "Across 8 account managers"],
          ["Needs review", "6", "2 customer promises due today"],
          ["On-time commitments", "91%", "Illustrative seven-day rate"],
          ["Recommendation acceptance", "68%", "Sample POC interaction rate"]
        ]}
      />
      <div className="equal-grid">
        <Panel
          title="Business data readiness"
          description="Sample source groups used to build account context"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={demo.refresh}
              leftIcon={<Icon name="refresh-cw" size="sm" />}
            >
              Refresh
            </Button>
          }
        >
          <SourceList />
        </Panel>
        <Panel
          title="Business controls"
          description="Illustrative policy settings for this demo session"
        >
          <div className="rows">
            {controls.map(([title, description], i) => (
              <div className="source-row" key={title}>
                <div className="grow">
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <Switch
                  aria-label={title}
                  checked={demo.policy[i]}
                  onChange={(checked) => {
                    demo.setPolicy((previous) =>
                      previous.map((value, index) => (index === i ? checked : value))
                    );
                    demo.setMessage(
                      `${title}: ${checked ? "enabled" : "paused"} in the demo configuration only.`
                    );
                  }}
                />
              </div>
            ))}
          </div>
          <p className="footnote">
            Controls demonstrate configuration only. They do not change live policy or
            send communications.
          </p>
        </Panel>
      </div>
      <div className="content-grid">
        <Panel
          title="Today’s team work"
          description="A sample of ready, review, blocked, and unowned work"
        >
          <DataTable
            label="Team workload"
            columns={[
              "Account manager",
              "Targets",
              "Ready",
              "Review",
              "Blocked",
              "Commitments due"
            ]}
            rows={team}
          />
        </Panel>
        <Panel title="Cross-role activity" description="Recent sample workspace updates">
          <div className="rows">
            {demo.notifications.slice(0, 5).map((item) => (
              <div className="source-row" key={item.id}>
                <span className="icon-tile">
                  <Icon name="activity" size="sm" />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>{item.time}</small>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Shared customer commitments"
        description="Live within this demo session"
        action={<Badge variant="primary">{demo.commitments.length} commitments</Badge>}
      >
        <CommitmentTable />
      </Panel>
      <Panel
        title="POC success measures"
        description="Illustrative measurements, not White Cap results"
      >
        <DataTable
          label="POC success measures"
          columns={["Measure", "What it answers", "POC method", "Illustrative view"]}
          rows={measures}
        />
      </Panel>
    </div>
  );
}
