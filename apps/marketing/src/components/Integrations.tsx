export function Integrations() {
  return (
    <section className="integrations-section" id="integrations">
      <div className="shell">
        <div className="section-intro reveal"><div><div className="section-eyebrow">Integration fabric</div><h2 className="section-title">Connect the stack you already run.</h2></div><p>Commerce service rarely lives in one platform. customerSAX is designed around a connector fabric spanning storefront, CRM, helpdesk, OMS, ERP, payments, returns, fulfillment, loyalty and messaging.</p></div>
        <div className="integration-matrix reveal">
          <div className="integration-nav"><button className="active" data-integration="commerce">Commerce</button><button data-integration="crm">CRM + service</button><button data-integration="ops">ERP + operations</button><button data-integration="payments">Payments</button><button data-integration="shipping">Shipping + returns</button><button data-integration="engagement">Engagement</button></div>
          <div className="integration-content"><div className="integration-head"><div><h3 id="integrationTitle">Commerce platforms</h3><p id="integrationDesc">Storefront, product, order and customer context.</p></div><span className="connector-count" id="connectorCount">7 ecosystem targets</span></div><div className="connector-grid" id="connectorGrid"></div><div className="integration-foot">Connector names describe the intended customerSAX ecosystem. Production status should be published transparently as <b>Available</b>, <b>Beta</b>, <b>Planned</b> or <b>via API</b> as the roadmap is finalized.</div></div>
        </div>
      </div>
    </section>
  );
}
