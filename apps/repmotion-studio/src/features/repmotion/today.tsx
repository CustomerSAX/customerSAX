"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Icon,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  PageHeader
} from "../../components/ui";
import { targets } from "./data";
import {
  ActionLink,
  CommitmentCapture,
  Metrics,
  Panel,
  SourceList,
  Status
} from "./components";
import { useDemo } from "./demo-state";

export function Today() {
  const demo = useDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<(typeof targets)[number] | null>(null);
  const visible = targets.filter(
    (target) =>
      (filter === "All" || target.status === filter) &&
      `${target.name} ${target.description}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={<span className="eyebrow">GOOD MORNING, MAYA</span>}
        title="Make every conversation count."
        subtitle="Five customers need your attention today. Here’s where to focus."
        actions={
          <Button
            variant="secondary"
            leftIcon={<Icon name="refresh-cw" size="sm" />}
            onClick={demo.refresh}
          >
            Refresh morning plan
          </Button>
        }
      />
      <Metrics
        items={[
          ["Assigned accounts", "38", "Midwest commercial portfolio"],
          ["Today’s targets", "5", "2 ready · 2 review · 1 blocked"],
          [
            "Open commitments",
            String(7 + demo.commitments.length - 3),
            "2 due before 3 PM"
          ],
          ["Upcoming meetings", "3", "Next: Summit at 2:30 PM"]
        ]}
      />
      <div className="insight-strip">
        <span className="icon-tile">
          <Icon name="sparkles" size="md" />
        </span>
        <div>
          <strong>A clearer view of your day.</strong>
          <p>
            38 accounts reviewed. 24 routine signals set aside. Five opportunities to move
            the customer relationship forward.
          </p>
        </div>
        <Badge variant="success" dot>
          Updated {demo.refreshTime || "8:06 AM"}
        </Badge>
      </div>
      <div className="content-grid">
        <Panel
          title="Today’s customer targets"
          description="Ranked by timing, customer impact, readiness, and ownership"
          action={<Badge variant="primary">5 priorities</Badge>}
        >
          <div className="target-toolbar">
            <Input
              aria-label="Search customer targets"
              placeholder="Search customer targets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Icon name="search" size="sm" />}
            />
            <div className="filter-group" aria-label="Filter by readiness">
              {["All", "Ready", "Review", "Blocked"].map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="target-list">
            {visible.map((target) => (
              <button
                className={`target-card status-${target.status.toLowerCase()}`}
                key={target.id}
                onClick={() => setSelected(target)}
              >
                <span className="target-number">0{targets.indexOf(target) + 1}</span>
                <div className="target-copy">
                  <div className="target-title">
                    <h3>{target.title}</h3>
                    <Status>{target.status}</Status>
                  </div>
                  <p>{target.description}</p>
                  <div className="evidence-chips">
                    {target.evidence.map((evidence) => (
                      <span key={evidence}>{evidence}</span>
                    ))}
                  </div>
                  <div className="target-bottom">
                    <strong>{target.value}</strong>
                    <span>
                      {target.timing}
                      <Icon name="arrow-up-right" size="sm" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {visible.length === 0 && (
              <div className="empty-state">
                <Icon name="search" size="lg" />
                <h3>No matching customer targets</h3>
                <p>Try another search or readiness filter.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("All");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </Panel>
        <aside className="page-stack">
          <section className="meeting-card">
            <div className="row-between">
              <span className="eyebrow">YOUR NEXT MEETING</span>
              <Icon name="calendar-days" size="md" />
            </div>
            <span className="meeting-time">
              2:30 <small>PM</small>
            </span>
            <h2>Summit Commercial Builders</h2>
            <p>Jordan Lee · Purchasing Director</p>
            <div className="meeting-agenda">
              {[
                "Confirm current project demand",
                "Review the $84,600 open quote",
                "Close the service loop"
              ].map((item, index) => (
                <div key={item}>
                  <span>0{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            <ActionLink href="/accounts/summit">Open meeting brief</ActionLink>
          </section>
          <Panel title="Business data readiness" description="Latest sample refresh">
            <SourceList compact />
          </Panel>
          <div className="quiet-note">
            <Icon name="shield-check" size="md" />
            <p>
              Evidence prepares the conversation. You confirm the customer’s need and
              decide the next step.
            </p>
          </div>
        </aside>
      </div>
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} size="lg">
        <ModalHeader
          title={selected?.name}
          subtitle="Customer target · Sample account context"
          onClose={() => setSelected(null)}
        />
        <ModalBody>
          {selected && (
            <>
              <Status>{selected.status}</Status>
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <div className="evidence-chips">
                {selected.evidence.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <strong>
                {selected.value} · {selected.timing}
              </strong>
              <div className="actions">
                {selected.id === "summit" ? (
                  <span onClick={() => setSelected(null)}>
                    <ActionLink href="/accounts/summit">
                      Open full meeting brief
                    </ActionLink>
                  </span>
                ) : selected.id === "cedar" ? (
                  <span onClick={() => setSelected(null)}>
                    <ActionLink href="/service">Review customer-care case</ActionLink>
                  </span>
                ) : (
                  <CommitmentCapture account={selected.name} />
                )}
              </div>
            </>
          )}
        </ModalBody>
      </Modal>
    </div>
  );
}
