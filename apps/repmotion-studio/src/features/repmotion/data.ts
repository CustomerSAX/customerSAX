/** Fictional fixtures adapted from the supplied October 6, 2026 POC. */
export const personas = [
  {
    id: "sales",
    name: "Maya Chen",
    initials: "MC",
    role: "Sales account manager",
    icon: "trending-up",
    href: "/today",
    description:
      "Start with five customer targets, prepare an evidence-backed conversation, and follow through on every promise."
  },
  {
    id: "service",
    name: "Ava Brooks",
    initials: "AB",
    role: "Customer care specialist",
    icon: "headset",
    href: "/service",
    description:
      "Resolve inquiries with the full customer context and keep the account owner informed."
  },
  {
    id: "manager",
    name: "David Kim",
    initials: "DK",
    role: "Sales manager",
    icon: "chart-no-axes-combined",
    href: "/manager",
    description:
      "See team workload, manage business controls, and track the quality of customer outcomes."
  }
] as const;
export type Persona = (typeof personas)[number]["id"];
export const targets = [
  {
    id: "summit",
    name: "Summit Commercial Builders",
    title: "Prepare for Summit Commercial Builders",
    description:
      "Meeting at 2:30 PM. Repeat-order timing, an active quote, a resolved service issue, and one open promise make this the highest-value conversation to prepare.",
    status: "Ready",
    value: "$126K context",
    timing: "Meeting today",
    evidence: ["Last order 78 days ago", "Typical cycle 90 days", "Quote $84,600"]
  },
  {
    id: "metro",
    name: "Metro Siteworks",
    title: "Recover the Metro Siteworks quote",
    description:
      "Two products that previously blocked quote Q-18442 are now available. Pricing remains current and no recent buyer contact is recorded.",
    status: "Ready",
    value: "$42.8K quote",
    timing: "Respond today",
    evidence: [
      "Quote valid through Friday",
      "Availability confirmed",
      "No duplicate outreach"
    ]
  },
  {
    id: "lakeside",
    name: "Lakeside Concrete",
    title: "Confirm Lakeside Concrete delivery promise",
    description:
      "You promised a delivery-date confirmation by 3 PM. The carrier response is available, but the revised date needs your review before customer communication.",
    status: "Review",
    value: "1 promise",
    timing: "Due at 3 PM",
    evidence: ["Commitment due 3 PM", "Carrier response received", "Customer waiting"]
  },
  {
    id: "northstar",
    name: "NorthStar Roofing",
    title: "Check NorthStar Roofing reorder timing",
    description:
      "Safety consumables have historically reordered every 55 to 65 days. It has been 58 days. Confirm current demand rather than assuming a reorder.",
    status: "Review",
    value: "$18.2K history",
    timing: "Confirm timing",
    evidence: ["Historical pattern", "Lead time 9 days", "Demand unconfirmed"]
  },
  {
    id: "cedar",
    name: "Cedar Ridge Builders",
    title: "Hold Cedar Ridge outreach",
    description:
      "A high-priority service case remains unresolved. RepMotion is holding a cross-sell recommendation until customer care confirms closure.",
    status: "Blocked",
    value: "Customer care",
    timing: "Wait for closure",
    evidence: ["Service case open", "Owner Ava Brooks", "Outreach suppressed"]
  }
];
export const sources = [
  [
    "Customers and pipeline",
    "Assigned accounts, contacts, opportunities, and ownership",
    "8:02 AM",
    "users"
  ],
  [
    "Orders and fulfillment",
    "Orders, deliveries, exceptions, and historical purchases",
    "8:04 AM",
    "package"
  ],
  [
    "Inventory and pricing",
    "Availability, branch position, lead time, and quote validity",
    "8:05 AM",
    "boxes"
  ],
  [
    "Meetings and interactions",
    "Recent notes, scheduled meetings, and communications",
    "8:01 AM",
    "messages-square"
  ],
  [
    "Customer care history",
    "Open cases, resolutions, and customer commitments",
    "7:59 AM",
    "headset"
  ]
];
export const conversation = [
  [
    "Meeting objective",
    "Confirm whether the next project phase requires a concrete-accessory replenishment order and agree on timing."
  ],
  [
    "Open with",
    "“Jordan, I wanted to close the loop on the replacement shipment and confirm what the next project phase looks like.”"
  ],
  [
    "Ask",
    "What quantities will the next phase require? When does the crew need material on site? Does Q-18719 still match the project scope?"
  ],
  [
    "Discuss",
    "Quote Q-18719 for $84,600 remains current through October 10. One delivery exception was resolved this morning."
  ],
  [
    "Avoid",
    "Do not say Summit is about to run out. Current customer inventory is unknown; the recommendation uses purchase history and lead time."
  ],
  [
    "Close with",
    "Agree on the next step, owner, and due date. Capture any pricing, availability, or delivery promise separately for validation."
  ]
];
export const orders = [
  ["Q-18719", "Project quote", "$84,600", "Current", "Confirm scope and order timing"],
  ["O-10489", "Open order", "$32,480", "Shipping", "Confirm delivery by Tuesday"],
  [
    "O-10248",
    "Historical order",
    "$41,200",
    "78 days ago",
    "Use only as timing evidence"
  ],
  ["OP-2231", "Project expansion", "$68,000", "Discovery", "Validate next project phase"]
];
export const initialCommitments = [
  {
    id: "shipment",
    title: "Confirm replacement shipment",
    account: "Summit Commercial Builders",
    owner: "Ava Brooks",
    due: "Oct 6, 9:00 AM",
    dependency: "Carrier confirmation",
    status: "Complete"
  },
  {
    id: "pricing",
    title: "Review project pricing",
    account: "Summit Commercial Builders",
    owner: "Maya Chen",
    due: "Oct 6, 3:00 PM",
    dependency: "Customer scope confirmation",
    status: "Open"
  },
  {
    id: "delivery",
    title: "Share updated delivery plan",
    account: "Summit Commercial Builders",
    owner: "Inside sales",
    due: "Oct 7, noon",
    dependency: "Order scheduling",
    status: "Waiting"
  }
];
export type Commitment = (typeof initialCommitments)[number];
export const cases = [
  {
    id: "CS-4408",
    account: "Summit Commercial Builders",
    status: "Ready",
    title: "Confirm Summit replacement shipment",
    description:
      "Confirm replacement shipment and share the result with the account owner before the 2:30 PM meeting.",
    due: "Promised by 9:00 AM",
    context: "Jordan Lee · Order O-10489 · Account owner Maya Chen",
    resolution: "Replacement shipment is scheduled for Tuesday.",
    evidence:
      "The fulfillment update confirms the replacement items are allocated and planned for Tuesday delivery. Record the confirmed customer update and share it with Maya.",
    ready: true
  },
  {
    id: "CS-4412",
    account: "Cedar Ridge Builders",
    status: "Escalated",
    title: "Review product substitution",
    description:
      "Product substitution requires specialist review before the customer can proceed.",
    due: "46 minutes open",
    context: "Owner Ava Brooks · Sales outreach on hold",
    resolution: "Specialist review is still outstanding.",
    evidence:
      "Keep sales outreach on hold until the specialist validates a suitable substitution and customer care confirms closure.",
    ready: false
  },
  {
    id: "CS-4399",
    account: "Metro Siteworks",
    status: "Review",
    title: "Confirm preferred-branch fulfillment",
    description: "Buyer asked whether the full quote can ship from the preferred branch.",
    due: "Connected to quote Q-18442",
    context: "Quote Q-18442 · $42,800 · Availability confirmed",
    resolution: "Confirm branch allocation before promising shipment.",
    evidence:
      "The previously unavailable items are now available. The preferred-branch shipping plan still needs review.",
    ready: false
  },
  {
    id: "CS-4394",
    account: "NorthStar Roofing",
    status: "Waiting",
    title: "Share updated safety documentation",
    description: "Customer requested an updated safety-document package.",
    due: "Customer response due tomorrow",
    context: "Safety consumables · Account demand unconfirmed",
    resolution: "The updated document package is pending.",
    evidence:
      "Wait for the approved safety documents before recording a customer response. The sample does not include a completed package.",
    ready: false
  }
];
export const controls = [
  ["Rep review before customer communication", "Review every draft or proposed promise."],
  ["Block outreach during severe service issues", "Prevent poorly timed sales contact."],
  [
    "Notify sales when customer care resolves a case",
    "Share the resolution with the account owner."
  ],
  [
    "Require evidence for every recommendation",
    "Show sources, freshness, and missing facts."
  ],
  ["Automatic customer communication", "Illustrative setting only; no messages are sent."]
];
export const team = [
  ["Maya Chen", "5", "2", "2", "1", "2 today"],
  ["Andre Williams", "5", "4", "1", "0", "1 today"],
  ["Priya Shah", "4", "3", "1", "0", "3 today"],
  ["Tom Becker", "5", "2", "1", "2", "1 overdue"],
  ["Unowned queue", "2", "0", "2", "0", "Needs assignment"]
];
export const measures = [
  [
    "Brief completion time",
    "Does preparation take less time?",
    "Compare current process with the POC task",
    "6 min vs. 28 min"
  ],
  [
    "Factual accuracy",
    "Can the rep trust the brief?",
    "Business-owner review of material facts",
    "94% sample"
  ],
  [
    "Recommendation acceptance",
    "Is the proposed work useful?",
    "Accepted, corrected, or dismissed by the rep",
    "68% sample"
  ],
  [
    "Commitments on time",
    "Does follow-through improve?",
    "Owner, due date, evidence, and notification",
    "91% sample"
  ],
  [
    "Cost per completed task",
    "Is the experience economical?",
    "Measure after a briefing passes quality review",
    "$0.21 sample"
  ]
];
export const journey = [
  {
    title: "Sign in by role",
    headline: "The workday starts from the role",
    description:
      "Sales, customer care, and managers use the same customer context to see the work relevant to their role.",
    outputs: [
      "Role and account access",
      "Assigned customers and queue",
      "Relevant policies",
      "Personal workspace"
    ],
    href: "/",
    action: "Choose a persona"
  },
  {
    title: "Build context",
    headline: "Business data becomes useful customer context",
    description:
      "Orders, quotes, inventory, pipeline, service, and interactions come together around the account, with sources and freshness attached.",
    outputs: [
      "Account timeline",
      "Orders and quotes",
      "Interactions and cases",
      "Freshness and ownership"
    ],
    href: "/accounts/summit",
    action: "Explore the account"
  },
  {
    title: "Prepare targets",
    headline: "Five customers that need attention today",
    description:
      "Repeat-purchase timing, stalled quotes, exceptions, promises, and scheduled meetings produce a short list. Every target explains why it appeared.",
    outputs: [
      "Five daily targets",
      "Evidence for each target",
      "Ready, review, or blocked",
      "Notification and owner"
    ],
    href: "/today",
    action: "See today’s targets"
  },
  {
    title: "Prepare and act",
    headline: "Enter the conversation prepared",
    description:
      "Review the meeting objective, customer history, service context, and talking points before approving the conversation plan.",
    outputs: [
      "Meeting objective",
      "Talking points and questions",
      "Recommended next step",
      "Rep review and approval"
    ],
    href: "/accounts/summit",
    action: "Open meeting brief"
  },
  {
    title: "Follow through",
    headline: "A shared outcome across every role",
    description:
      "Capture commitments, owners, and due dates. Customer care sees sales promises, while managers see workload, exceptions, and outcome quality.",
    outputs: [
      "Captured commitment",
      "Cross-role notification",
      "Manager visibility",
      "Measured business result"
    ],
    href: "/manager",
    action: "Open manager console"
  }
];
