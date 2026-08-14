const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'docs/marketing/index.html');
const outPath = path.join(__dirname, 'apps/marketing/src/app/page.tsx');

let html = fs.readFileSync(htmlPath, 'utf-8');

// Extract everything inside <main id="top"> ... </main>
const mainMatch = html.match(/<main id="top">([\s\S]*?)<\/main>/);
if (!mainMatch) {
  console.error("Could not find <main>");
  process.exit(1);
}

let mainContent = mainMatch[1];

// Replace class= with className=
mainContent = mainContent.replace(/class=/g, 'className=');

// Fix self closing tags like <img> or <hr> or <br>
mainContent = mainContent.replace(/<br>/g, '<br />');

// React component wrapper
const pageTsx = `
'use client';
import { useState } from 'react';

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

export default function Home() {
  const [activeCase, setActiveCase] = useState<keyof typeof cases>('wismo');
  const currentCase = cases[activeCase];

  // We need to inject the activeCase logic dynamically into the switcher HTML
  // We'll replace the static HTML block with React logic.

  return (
    <main id="top">
      ${mainContent}
    </main>
  );
}
`;

fs.writeFileSync(outPath, pageTsx);
console.log('page.tsx generated successfully.');
