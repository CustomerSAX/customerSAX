export function ProductDemo() {
  return (
    <div className="product-stage">
      <div className="shell">
        <div className="product-frame reveal" aria-label="customerSAX product workspace concept">
          <div className="app">
            <aside className="app-sidebar">
              <div className="app-brand"><span className="brand-mark">SAX</span> customerSAX</div>
              <div className="side-label">Service</div>
              <div className="side-item active"><span className="side-icon">◫</span> Inbox <span style={{marginLeft: 'auto', color: '#fff'}}>18</span></div>
              <div className="side-item"><span className="side-icon">◉</span> Voice &amp; messaging</div>
              <div className="side-item"><span className="side-icon">◎</span> Customers</div>
              <div className="side-item"><span className="side-icon">▣</span> Cases &amp; tasks</div>
              <div className="side-item"><span className="side-icon">⌁</span> Knowledge</div>
              <div className="side-label">Workforce</div>
              <div className="side-item"><span className="side-icon">✦</span> AI workforce</div>
              <div className="side-item"><span className="side-icon">◫</span> Queues &amp; routing</div>
              <div className="side-item"><span className="side-icon">✓</span> Quality</div>
              <div className="side-item"><span className="side-icon">⌘</span> Automations</div>
              <div className="side-item"><span className="side-icon">▤</span> Knowledge</div>
              <div className="side-label">Operations</div>
              <div className="side-item"><span className="side-icon">◇</span> Integrations</div>
              <div className="side-item"><span className="side-icon">◒</span> Insights</div>
              <div className="side-spacer"></div>
              <div className="workspace-info">ACME Commerce<br/><span style={{color: '#5f6672'}}>Enterprise workspace</span></div>
            </aside>
            <div className="app-main">
              <div className="app-top"><div className="crumb">Inbox / <b>Order exception · #CS-1842</b></div><div className="top-actions"><div className="top-pill">SLA · 14m</div><div className="top-pill">Assign</div><div className="avatar">MK</div></div></div>
              <div className="app-body">
                <section className="conversation">
                  <div className="case-head"><div className="case-meta"><span className="status-dot"></span> Open · Email · Priority customer</div><h3>Replacement still hasn’t arrived</h3><p>Customer wants shipment status and an express-shipping refund.</p></div>
                  <div className="thread">
                    <div className="msg"><div className="msg-avatar">AJ</div><div className="bubble"><b>Avery Johnson · 8:42 AM</b>Hi — my replacement was supposed to arrive yesterday and tracking hasn’t moved for three days. I paid for express shipping. Can you tell me what’s happening and refund the shipping charge?</div></div>
                    <div className="msg ai"><div className="msg-avatar">SAX</div><div className="bubble"><b>customerSAX · Resolution plan</b>I found the replacement order, carrier exception and payment. The parcel is delayed at the regional hub and qualifies for the express-shipping guarantee.<div className="ai-card"><div className="ai-title"><span>Recommended resolution</span><span>Policy confidence 98%</span></div><div style={{fontSize: '10px', lineHeight: 1.55, color: '#515a70'}}>Refund $18.00 express shipping, keep the replacement in transit, notify the customer, and open a carrier delay watch. No reship needed yet.</div><div className="ai-actions"><span className="action-chip">Refund $18.00</span><span className="action-chip">Watch shipment</span><span className="action-chip">Send update</span></div></div></div></div>
                    <div className="msg"><div className="msg-avatar">MK</div><div className="bubble"><b>Maya · Agent note</b>Looks right. Approving refund and customer update.</div></div>
                  </div>
                  <div className="composer"><div className="compose-box">Reply to Avery…<div className="compose-row"><span>✦ Draft with SAX</span><span className="send">Send reply</span></div></div></div>
                </section>
                <aside className="context-pane">
                  <div className="ctx-head"><div className="customer-row"><div className="msg-avatar">AJ</div><div><b>Avery Johnson</b><span>Gold loyalty · 8 orders · $1,284 LTV</span></div></div></div>
                  <div className="ctx-section"><div className="ctx-title"><span>Current order</span><span>#104872</span></div><div className="order-card"><div className="order-top"><b>Replacement order</b><span>In transit</span></div><div className="order-line"><div className="prod-img"></div><div className="prod-copy"><b>Studio Runner · Black</b><span>Size 9 · Qty 1</span></div><div className="price">$168</div></div></div></div>
                  <div className="ctx-section"><div className="ctx-title"><span>Live commerce context</span><span>6 systems</span></div><div className="data-list"><div className="data-row"><span>Shopify</span><span>Fulfilled · Aug 11</span></div><div className="data-row"><span>DHL</span><span>Hub delay · 3 days</span></div><div className="data-row"><span>Stripe</span><span>Paid · $186.00</span></div><div className="data-row"><span>Loyalty</span><span>Gold · 1,920 pts</span></div><div className="data-row"><span>Returns</span><span>Replacement case R-332</span></div><div className="data-row"><span>CRM</span><span>Priority customer</span></div></div></div>
                  <div className="ctx-section"><div className="ctx-title"><span>Resolution</span><span>Guarded action</span></div><div className="resolution"><div className="res-step"><div className="res-icon">1</div><div className="res-copy"><b>Validate guarantee</b><span>Shipping policy + fulfillment state</span></div></div><div className="res-step"><div className="res-icon">2</div><div className="res-copy"><b>Refund shipping</b><span>Stripe · $18.00</span></div></div><div className="res-step"><div className="res-icon">3</div><div className="res-copy"><b>Monitor shipment</b><span>DHL exception watch</span></div></div><div className="approval"><span>Human approval required</span><button>Approve</button></div></div></div>
                </aside>
              </div>
            </div>
          </div>
        </div>
        <div className="frame-caption reveal"><span><b>One workspace.</b> Conversation, customer, order, policy and action plan in context.</span><span>Concept product UI · connectors shown are illustrative</span></div>
      </div>
    </div>
  );
}
