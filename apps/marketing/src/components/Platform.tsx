export function Platform() {
  return (
    <section className="problem-section" id="platform">
      <div className="shell problem-layout">
        <div className="problem-statement reveal"><div className="section-eyebrow">The problem</div><h2 className="section-title narrow">One customer question. Six disconnected systems.</h2><p>The ticket is only the visible edge of the work. Real ecommerce support requires transaction context, policy decisions and actions across the systems behind the conversation.</p><div className="problem-number">06</div></div>
        <div className="journey-list reveal">
          <div className="journey-row"><span className="journey-num">01</span><span className="journey-system">Storefront</span><span className="journey-desc">Orders, products, inventory, customer tags</span><span className="journey-state">Context</span></div>
          <div className="journey-row"><span className="journey-num">02</span><span className="journey-system">CRM / Helpdesk</span><span className="journey-desc">Identity, conversations, SLA, relationship history</span><span className="journey-state">Context</span></div>
          <div className="journey-row"><span className="journey-num">03</span><span className="journey-system">OMS / ERP</span><span className="journey-desc">Fulfillment, allocation, inventory and order lifecycle</span><span className="journey-state">Action</span></div>
          <div className="journey-row"><span className="journey-num">04</span><span className="journey-system">Payments</span><span className="journey-desc">Charges, refunds, disputes, credits and subscriptions</span><span className="journey-state">Action</span></div>
          <div className="journey-row"><span className="journey-num">05</span><span className="journey-system">Returns</span><span className="journey-desc">Eligibility, exchange inventory, labels and reimbursements</span><span className="journey-state">Action</span></div>
          <div className="journey-row"><span className="journey-num">06</span><span className="journey-system">Carrier / 3PL</span><span className="journey-desc">Tracking, exceptions, claims and delivery evidence</span><span className="journey-state">Action</span></div>
          <div className="journey-row emphasis"><span className="journey-num">→</span><span className="journey-system">customerSAX</span><span className="journey-desc">Unifies context, policy, reasoning and governed execution</span><span className="journey-state">Resolution</span></div>
        </div>
      </div>
    </section>
  );
}
