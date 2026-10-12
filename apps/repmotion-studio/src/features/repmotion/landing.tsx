"use client";

import Link from "next/link";
import { Badge, Card, Icon } from "../../components/ui";
import { personas } from "./data";
import { ActionLink } from "./components";

export function Landing() {
  return (
    <div className="landing">
      <section className="landing-intro">
        <Badge variant="primary" dot>
          THE CONNECTED SALES WORKSPACE
        </Badge>
        <h1>
          Choose your role.
          <br />
          <span>Focus on what matters.</span>
        </h1>
        <p>
          One customer story. A better way to work together. Discover how RepMotion turns
          shared context into a prepared conversation, a resolved inquiry, and a promise
          kept.
        </p>
      </section>
      <section className="persona-grid" aria-label="Choose a demo persona">
        {personas
          .filter((persona) => persona.id !== "service")
          .map((persona) => (
            <Link
              href={persona.href}
              key={persona.id}
              className={`persona-link ${persona.id === "sales" ? "featured" : ""}`}
            >
              <Card className="persona-card">
                <div className="row-between">
                  <span className="persona-icon">
                    <Icon name={persona.icon} size="lg" />
                  </span>
                  {persona.id === "sales" && <Badge variant="primary">START HERE</Badge>}
                </div>
                <span className="eyebrow">
                  {persona.id === "sales" ? "PREPARE & CONNECT" : "LEAD & IMPROVE"}
                </span>
                <h2>{persona.role}</h2>
                <p>{persona.description}</p>
                <div className="persona-enter">
                  <div className="person">
                    <span className="avatar">{persona.initials}</span>
                    <span>
                      Enter as <strong>{persona.name}</strong>
                    </span>
                  </div>
                  <Icon name="arrow-up-right" size="md" />
                </div>
              </Card>
            </Link>
          ))}
      </section>
      <section className="guided-banner">
        <span className="icon-tile">
          <Icon name="route" size="lg" />
        </span>
        <div className="grow">
          <h2>See how it all connects.</h2>
          <p>A five-step journey from the first signal to customer follow-through.</p>
        </div>
        <ActionLink href="/demo-flow" secondary>
          Explore the guided flow
        </ActionLink>
      </section>
      <div className="landing-footnote">
        <Icon name="shield-check" size="sm" />
        <span>Fictional accounts. Shared context. Human decisions.</span>
      </div>
    </div>
  );
}
