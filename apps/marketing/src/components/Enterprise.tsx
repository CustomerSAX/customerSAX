export function Enterprise() {
  return (
    <section id="enterprise">
      <div className="shell governance">
        <div className="governance-copy reveal"><div className="section-eyebrow">Enterprise control</div><h2 className="section-title narrow">Autonomy should be earned, not assumed.</h2><p>customerSAX is designed for progressive automation. Start by observing and recommending. Add human approval for sensitive actions. Move only proven, low-risk intents to autonomous resolution.</p><a className="btn" href="#demo">Discuss enterprise architecture →</a></div>
        <div className="governance-list reveal">
          <div className="gov-row"><div className="gov-icon">01</div><div><b>Read before write</b><span>Connect systems in read-only mode first. Validate identity, data quality, policy and expected decisions before enabling actions.</span></div></div>
          <div className="gov-row"><div className="gov-icon">02</div><div><b>Policy-bound actions</b><span>Every action can be constrained by amount, customer tier, order state, geography, role, confidence or business policy.</span></div></div>
          <div className="gov-row"><div className="gov-icon">03</div><div><b>Human-in-the-loop</b><span>Require approval for refunds, exceptions, loyalty adjustments, cancellations or any workflow your business considers sensitive.</span></div></div>
          <div className="gov-row"><div className="gov-icon">04</div><div><b>Full audit trail</b><span>Record the context used, decision path, tools called, data changed, approval and resulting customer outcome.</span></div></div>
          <div className="gov-row"><div className="gov-icon">05</div><div><b>Measure resolution quality</b><span>Track not only deflection, but policy accuracy, action success, recontact, customer satisfaction and commercial outcome.</span></div></div>
        </div>
      </div>
    </section>
  );
}
