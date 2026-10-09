"use client";

import { useState } from "react";
import {
  Badge,
  Icon,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "../../components/ui";
import { ActionLink, DataTable, Panel } from "./components";
import { journey } from "./data";

export function Flow() {
  const [step, setStep] = useState("0");
  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={<span className="eyebrow">THE CONNECTED CUSTOMER JOURNEY</span>}
        title="From sign-in to follow-through."
        subtitle="Five steps. Three roles. One shared customer story."
        actions={<ActionLink href="/today">Start sales demo</ActionLink>}
      />
      <Tabs value={step} onValueChange={setStep} variant="boxed">
        <TabsList>
          {journey.map((item, i) => (
            <TabsTrigger key={item.title} value={String(i)}>
              <span className="step-number">0{i + 1}</span>
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {journey.map((item, i) => (
          <TabsContent key={item.title} value={String(i)}>
            <div className="journey-detail">
              <div className="journey-copy">
                <Badge variant="primary">STEP 0{i + 1}</Badge>
                <h2>{item.headline}</h2>
                <p>{item.description}</p>
                <ActionLink href={item.href}>{item.action}</ActionLink>
              </div>
              <div className="journey-outputs">
                {item.outputs.map((output, index) => (
                  <div key={output}>
                    <span className="icon-tile">
                      <Icon name="check" size="sm" />
                    </span>
                    <div>
                      <small>OUTPUT 0{index + 1}</small>
                      <strong>{output}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <Panel
        title="A connected experience across roles"
        description="Each role contributes to the same customer outcome"
      >
        <DataTable
          label="Cross-role journey"
          columns={["Role", ...journey.map((item) => item.title)]}
          rows={[
            [
              "Shared context",
              "Identify the user",
              "Assemble the account",
              "Detect material changes",
              "Keep evidence attached",
              "Capture the outcome"
            ],
            [
              "Sales rep",
              "See assigned portfolio",
              "Open account context",
              "Receive five targets",
              "Prepare the meeting",
              "Own the promise"
            ],
            [
              "Customer care",
              "See service queue",
              "Reuse sales context",
              "Prioritize customer impact",
              "Resolve with context",
              "Share the resolution"
            ],
            [
              "Sales manager",
              "Set access and rules",
              "Monitor readiness",
              "Review workload",
              "Watch quality",
              "Measure outcomes"
            ]
          ]}
        />
      </Panel>
    </div>
  );
}
