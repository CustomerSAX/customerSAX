import type { PriorityItem } from "./types";

export const initialPriorities: PriorityItem[] = [
  {
    id: "priority-oakridge",
    accountId: "oakridge",
    accountName: "Oak Ridge Concrete",
    accountTier: "Enterprise",
    annualSpend: "$1.42M YTD",
    category: "service_hold",
    categoryLabel: "Delivery Exception",
    urgency: "today",
    urgencyLabel: "Critical Jobsite Delay",
    readiness: "blocked",
    title: "Order #WC-1042 Split Shipment: Pallet 2 Delayed for Site 02 Pour",
    description: "Northway Commercial Center (Site 02): Pallet 1 (20 boxes wedge anchors) was delivered at 7:30 AM, but Pallet 2 (20 boxes tie-wire) is delayed at Branch #12. Slab pour is scheduled for 11:30 AM.",
    potentialValue: "$18.4K Pour at Risk",
    evidence: [
      "Order WC-1042 split into 2 shipments by Branch #12",
      "Shipment SH-01 (Anchors) signed by Foreman Dave at 7:30 AM",
      "Shipment SH-02 (Tie-Wire) carrier delayed 90 minutes without confirmed ETA",
      "Branch #12 has 40 boxes in stock for emergency hot-shot courier"
    ],
    primaryContact: {
      name: "Dave Henderson",
      role: "Jobsite General Superintendent",
      phone: "+1 (312) 555-0194",
      email: "dave.henderson@oakridgeconcrete.com",
      avatarInitials: "DH"
    },
    serviceEscalation: {
      caseNumber: "CASE-1042-DELIV",
      assignedSpecialist: "Branch #12 Dispatch (Gary)",
      priority: "Urgent",
      status: "Carrier Delay Reported",
      subject: "Split shipment pallet 2 delayed - concrete pour scheduled 11:30 AM",
      openedAt: "Today, 7:45 AM",
      resolutionNote: "Local branch courier van standing by to expedite missing 20 boxes directly to Northway jobsite trailer.",
      blocksPromotionalOutreach: true,
      policyMessage: "Do not pitch new products until tie-wire arrives at Site 02."
    }
  },
  {
    id: "priority-apex",
    accountId: "apex",
    accountName: "Apex Commercial Framing",
    accountTier: "Strategic",
    annualSpend: "$780K YTD",
    category: "quote_unblocked",
    categoryLabel: "Expiring Quote",
    urgency: "today",
    urgencyLabel: "Expires 5:00 PM Today",
    readiness: "ready",
    title: "Quote #Q-410 ($42,800) Needs 1-Click E-Sign Accept Link",
    description: "120 boxes of structural framing fasteners & anchors. Price protection approved by Branch Manager David Kim. Buyer requested digital accept link to lock pricing before end of day.",
    potentialValue: "$42,800 Approved Quote",
    evidence: [
      "All 120 boxes confirmed in stock across Chicago Hub and Branch #14",
      "Branch Director margin discount of 8% signed off",
      "Buyer Marcus Vance opened portal quote 3 times this morning"
    ],
    primaryContact: {
      name: "Marcus Vance",
      role: "Lead Estimator & Buyer",
      phone: "+1 (312) 555-0142",
      email: "mvance@apexframing.com",
      avatarInitials: "MV"
    },
    unblockedQuote: {
      quoteNumber: "Q-410",
      totalAmount: 42800,
      discountPct: 8,
      validUntil: "Today, 5:00 PM CST",
      unblockedItems: [
        {
          sku: "CON-ANCH-20",
          name: "Heavy-Duty 1/2in x 7in Wedge Anchors (Box of 25)",
          quantity: 80,
          branchLocation: "Branch #12 (Chicago Central)",
          stockAvailable: 110,
          unitPrice: 320
        },
        {
          sku: "FRM-FAST-08",
          name: "Structural Framing Clips & Hardware Fasteners",
          quantity: 40,
          branchLocation: "Branch #14 (Dallas Hub Transfer)",
          stockAvailable: 65,
          unitPrice: 430
        }
      ]
    }
  },
  {
    id: "priority-metro",
    accountId: "metro",
    accountName: "Metro Foundations",
    accountTier: "Core",
    annualSpend: "$520K YTD",
    category: "promise_due",
    categoryLabel: "Field Promise Due",
    urgency: "today",
    urgencyLabel: "Due by 3:00 PM Today",
    readiness: "ready",
    title: "Deliver Epoxy Rebar Doweling Engineering Submittal",
    description: "Promised to Project Engineer Elena during yesterday's jobsite walkthrough. Technical structural certification packet is signed by White Cap engineering specialist and ready to transmit.",
    potentialValue: "1 Open Commitment",
    evidence: [
      "Promise logged yesterday at 3:15 PM by Alex Miller",
      "White Cap Technical Specialist approved epoxy shear-stress calculation",
      "Engineer Elena needs sign-off before inspectors arrive tomorrow"
    ],
    primaryContact: {
      name: "Elena Rostova",
      role: "Project Engineering Lead",
      phone: "+1 (312) 555-0187",
      email: "elena@metrofoundations.com",
      avatarInitials: "ER"
    },
    promiseContext: {
      promiseTitle: "Deliver Epoxy Doweling Submittal (ASTM C881 Grade)",
      dueTime: "Today at 3:00 PM CST",
      dependency: "Structural Engineering certification attached"
    }
  },
  {
    id: "priority-tristate",
    accountId: "tristate",
    accountName: "Tri-State Infrastructure",
    accountTier: "Enterprise",
    annualSpend: "$1.65M YTD",
    category: "reorder_cadence",
    categoryLabel: "Stock Shortage Solution",
    urgency: "this_week",
    urgencyLabel: "Branch Transfer Ready",
    readiness: "review",
    title: "Resolve 1/2in Wedge Anchor Shortage via Branch #14 Transfer",
    description: "Tri-State needs 60 boxes for I-80 Bridge repair. Serving branch has 15 boxes; neighboring Branch #14 has 85 boxes with guaranteed overnight internal transfer.",
    potentialValue: "$19,500 Bridge Order",
    evidence: [
      "Serving branch inventory: 15 boxes (45 box deficit)",
      "Branch #14 (Rockford) transfer route departs daily at 5:00 PM",
      "Certified equivalent Hilti/Simpson alternative also pre-approved"
    ],
    primaryContact: {
      name: "Greg Thornton",
      role: "VP Heavy Civil Procurement",
      phone: "+1 (312) 555-0176",
      email: "gthornton@tristateinfra.com",
      avatarInitials: "GT"
    }
  }
];
