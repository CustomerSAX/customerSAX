export function Workforce() {
  return (
    <section className="workforce-section" id="workforce">
      <div className="shell">
        <div className="section-intro reveal"><div><div className="section-eyebrow">The service workforce</div><h2 className="section-title">Human agent versus AI agent is the wrong final question.</h2></div><p>The useful question is: <b>which work belongs to which worker?</b> customerSAX lets the same customer journey move between AI-led, human-assisted and human-led service without losing context.</p></div>
        <div className="workforce-map reveal">
          <div className="force-column">
            <div className="force-label">Human service agent</div><h3>Judgment, empathy and exceptions.</h3><p>Humans remain essential where the business needs discretion, negotiation, recovery, relationship judgment or accountability.</p>
            <div className="force-list"><div className="force-item"><span>Availability</span><span>Scheduled capacity</span></div><div className="force-item"><span>Best at</span><span>Ambiguity + empathy</span></div><div className="force-item"><span>Authority</span><span>Discretionary</span></div><div className="force-item"><span>Complexity</span><span>Novel exceptions</span></div><div className="force-item"><span>Customer moments</span><span>High risk / high value</span></div></div>
          </div>
          <div className="force-bridge"><div className="bridge-mark">SAX</div><b>One queue.<br />One context.<br />One policy.</b><span>Route work to the right human or AI worker.</span></div>
          <div className="force-column ai">
            <div className="force-label">AI service agent</div><h3>Scale, speed and policy-bound execution.</h3><p>AI excels when work is repetitive, data-heavy, time-sensitive and governed by clear rules that can be observed and audited.</p>
            <div className="force-list"><div className="force-item"><span>Availability</span><span>Always on</span></div><div className="force-item"><span>Best at</span><span>Volume + lookup + action</span></div><div className="force-item"><span>Authority</span><span>Guardrail-bound</span></div><div className="force-item"><span>Complexity</span><span>Repeatable procedures</span></div><div className="force-item"><span>Customer moments</span><span>Fast / predictable</span></div></div>
          </div>
        </div>
        <div className="mode-grid reveal">
          <article className="mode-card"><span className="mode-chip">AI-led</span><b>Routine resolution</b><p>Order status, simple returns, policy Q&A, appointment changes, known billing issues and other proven intents.</p></article>
          <article className="mode-card"><span className="mode-chip">Human + AI</span><b>Assisted resolution</b><p>AI gathers context and prepares the action; the human reviews, adapts, approves and owns the customer relationship.</p></article>
          <article className="mode-card"><span className="mode-chip">Human-led</span><b>Exceptions & recovery</b><p>Complex complaints, vulnerable customers, fraud, negotiation, policy exceptions and high-value recovery stay human-led.</p></article>
        </div>
      </div>
    </section>
  );
}
