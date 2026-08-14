'use client';
import { useState, useEffect } from 'react';

const cases = {
  wismo: {
    label: 'Post-purchase service',
    quote: '“My order was due yesterday. Tracking hasn’t moved. Where is it?”',
    steps: [
      ['Identify', 'Match customer + order across channel and storefront.'],
      ['Investigate', 'Read fulfillment, carrier events and delivery exception.'],
      ['Decide', 'Apply service policy and determine reship / wait / refund options.'],
      ['Resolve', 'Send update, set shipment watch and take approved action.']
    ],
    result: 'Result: the customer receives a specific answer and the next operational step without an agent searching multiple systems.'
  },
  return: {
    label: 'Returns & exchanges',
    quote: '“These shoes are too small. Can I exchange them for a size 10?”',
    steps: [
      ['Understand', 'Identify order, item, return window and reason.'],
      ['Check', 'Validate policy and live replacement inventory.'],
      ['Plan', 'Select exchange, label and price-adjustment workflow.'],
      ['Execute', 'Create return, reserve size 10 and notify customer.']
    ],
    result: 'Result: policy, inventory and return execution become one guided journey instead of three separate tools.'
  },
  cancel: {
    label: 'Order management',
    quote: '“I entered the wrong shipping address. Can you fix it before it goes out?”',
    steps: [
      ['Locate', 'Find order and current fulfillment state.'],
      ['Guard', 'Check whether address change is still allowed.'],
      ['Update', 'Write approved address to OMS / storefront.'],
      ['Confirm', 'Return confirmation and preserve audit history.']
    ],
    result: 'Result: customerSAX acts only while the fulfillment state permits the change; otherwise it escalates with the correct alternative.'
  },
  billing: {
    label: 'Billing & subscriptions',
    quote: '“I was charged twice and I need one of these payments reversed.”',
    steps: [
      ['Verify', 'Find payment intents, captures and order relationship.'],
      ['Classify', 'Determine duplicate capture vs. separate orders.'],
      ['Approve', 'Apply refund threshold and fraud / risk rules.'],
      ['Resolve', 'Issue eligible refund or escalate with evidence.']
    ],
    result: 'Result: the platform connects payment context to the customer conversation and applies explicit financial guardrails.'
  },
  product: {
    label: 'Pre-purchase commerce',
    quote: '“Will this jacket work for Chicago winter, and is my size available today?”',
    steps: [
      ['Profile', 'Use customer size, preference and prior purchase context.'],
      ['Search', 'Read product attributes, content and live inventory.'],
      ['Recommend', 'Explain fit, weather suitability and alternatives.'],
      ['Convert', 'Deep-link or reserve eligible inventory where supported.']
    ],
    result: 'Result: customer service becomes a conversion surface because product answers are grounded in live commerce data.'
  }
};

export function UseCases() {
  const [activeCase, setActiveCase] = useState<keyof typeof cases>('wismo');
  const currentCase = cases[activeCase];

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);
  return (
    <section id="usecases" className="problem-section">
      <div className="shell">
        <div className="section-intro reveal"><div><div className="section-eyebrow">Resolution journeys</div><h2 className="section-title">The conversation is different. The operating model is the same.</h2></div><p>Every journey starts with intent, gathers the right commerce context, checks policy and then chooses the safest resolution path — autonomous, assisted or human-led.</p></div>
        <div className="switcher reveal">
          <div className="tabs" role="tablist">
            <button className={`tab ${activeCase === 'wismo' ? 'active' : ''}`} onClick={() => setActiveCase('wismo')}><b>Where is my order?</b><span>Post-purchase tracking and fulfillment</span></button>
            <button className={`tab ${activeCase === 'return' ? 'active' : ''}`} onClick={() => setActiveCase('return')}><b>Returns &amp; exchanges</b><span>Policy, inventory and reverse logistics</span></button>
            <button className={`tab ${activeCase === 'cancel' ? 'active' : ''}`} onClick={() => setActiveCase('cancel')}><b>Order modifications</b><span>Cancellations, address updates and state</span></button>
            <button className={`tab ${activeCase === 'billing' ? 'active' : ''}`} onClick={() => setActiveCase('billing')}><b>Billing &amp; subscriptions</b><span>Refunds, disputes and payment intent</span></button>
            <button className={`tab ${activeCase === 'product' ? 'active' : ''}`} onClick={() => setActiveCase('product')}><b>Pre-purchase &amp; product</b><span>Live inventory, sizing and suitability</span></button>
          </div>
          <div className="case-panel">
            <div className="case-panel-head">
              <b>{currentCase.label}</b>
              <span>Resolution path</span>
            </div>
            <div className="case-panel-body">
              <p className="case-quote">{currentCase.quote}</p>
              <div className="resolution-grid">
                {currentCase.steps.map((step, i) => (
                  <div className="res-cell" key={i}>
                    <small>Step 0{i + 1}</small>
                    <b>{step[0]}</b>
                    <p>{step[1]}</p>
                  </div>
                ))}
              </div>
              <div className="case-result">
                {currentCase.result}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
