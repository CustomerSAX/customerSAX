import type { Account360 } from "./types";

export const accountsDirectory: Record<string, Account360> = {
  oakridge: {
    id: "oakridge",
    name: "Oak Ridge Concrete",
    tier: "Enterprise",
    industry: "Heavy Commercial & Industrial Concrete",
    region: "Midwest District (Branch #12)",
    headquarters: "Chicago, IL",
    accountManager: "Alex Miller",
    annualSpend: 1420000,
    spendTrendPct: 12.8,
    healthScore: 68,
    healthStatus: "Service Hold",
    openOrdersCount: 2,
    openQuotesValue: 24500,
    deliveryReliabilityPct: 88.0,
    contacts: [
      {
        id: "c-or-1",
        name: "Dave Henderson",
        role: "Jobsite Operations",
        title: "General Jobsite Superintendent",
        phone: "+1 (312) 555-0194",
        email: "dave.henderson@oakridgeconcrete.com",
        isPrimary: true,
        avatarInitials: "DH"
      },
      {
        id: "c-or-2",
        name: "Sarah Jenkins",
        role: "Procurement",
        title: "Director of Estimating & Purchasing",
        phone: "+1 (312) 555-0122",
        email: "sjenkins@oakridgeconcrete.com",
        avatarInitials: "SJ"
      }
    ],
    conversationPlan: {
      meetingObjective: "Confirm Northway Commercial Center (Site 02) concrete slab pour timing and verify emergency courier delivery of missing tie-wire.",
      openWith: "Dave, I know Pallet 2 tie-wire was delayed from the branch this morning. Branch #12 has a dedicated hot-shot van arriving at 10:45 AM, well before your 11:30 AM pour.",
      keyQuestionsToAsk: [
        "Is the foundation inspection still cleared for 1:00 PM once the tie-wire is in place?",
        "Do you need additional 1/2in wedge anchors staged for Phase 2 retaining walls next Tuesday?",
        "Will cold-weather curing blankets and heaters be needed on site for next week's temperature drop?"
      ],
      discussionTopics: [
        "Hot-shot courier van dispatched from Branch #12 with 20 boxes tie-wire (ETA: 10:45 AM).",
        "Shipment SH-01 (20 boxes wedge anchors) successfully delivered and signed at 7:30 AM.",
        "Quote Q-412 ($24,500) for cold-weather blankets is drafted with locked branch pricing."
      ],
      topicsToAvoid: [
        "Do NOT pitch new unrelated tools or accessories until Dave confirms the tie-wire arrives at the trailer.",
        "Do not debate carrier delays on the jobsite; emphasize White Cap resolution."
      ],
      recommendedNextStep: "Meet the courier at the trailer gate, verify pallet handoff, and inspect anchor spacing with Dave.",
      isApproved: true
    },
    orders: [
      {
        id: "o-wc1042",
        orderNumber: "WC-1042",
        type: "Split Jobsite Order",
        amount: 18400,
        currency: "USD",
        orderState: "Split Delivery",
        shipmentState: "Exception",
        orderDate: "Today, 6:00 AM",
        lineItemCount: 2,
        deliveryAddress: "Site 02 · Northway Commercial Center (Gate 4)"
      }
    ],
    quotes: [
      {
        id: "q-412",
        quoteNumber: "Q-412",
        title: "Cold-Weather Concrete Curing Blankets & Accessories",
        totalAmount: 24500,
        discountPct: 6,
        marginPct: 28.5,
        status: "Ready to Send",
        validUntil: "Oct 28, 2026",
        lineItems: [
          { sku: "CON-BLNK-12", name: "Multi-Layer Insulated Curing Blankets (12ft x 25ft, R-4 Value)", quantity: 30, unitPrice: 550, subtotal: 16500 },
          { sku: "CON-HTR-40", name: "Portable Jobsite Propane Ground Heaters (40,000 BTU)", quantity: 4, unitPrice: 2000, subtotal: 8000 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: true,
      activeCartTotal: 12800,
      activeCartItemCount: 4,
      lastPortalVisit: "Today, 6:30 AM",
      recentlyViewedCategories: ["Concrete Curing", "Wedge Anchors"]
    },
    serviceCases: [
      {
        id: "sc-1042",
        caseNumber: "CASE-1042-DELIV",
        subject: "Order WC-1042 split shipment pallet 2 delayed at Branch #12",
        priority: "Urgent",
        status: "In Progress",
        assignedSpecialist: "Branch #12 Dispatch (Gary)",
        openedDate: "Today, 7:45 AM",
        blocksSalesOutreach: true,
        blockReason: "Active delivery delay threatens 11:30 AM concrete slab pour on Site 02."
      }
    ],
    evidenceHistory: [
      { title: "Hot-Shot Dispatched", detail: "Branch #12 van departed with 20 boxes tie-wire.", timestamp: "8:15 AM", source: "Branch Dispatch" }
    ]
  },
  apex: {
    id: "apex",
    name: "Apex Commercial Framing",
    tier: "Strategic",
    industry: "Structural Steel & Commercial Framing",
    region: "Midwest District (Branch #12)",
    headquarters: "Chicago, IL",
    accountManager: "Alex Miller",
    annualSpend: 780000,
    spendTrendPct: 8.5,
    healthScore: 84,
    healthStatus: "Attention Needed",
    openOrdersCount: 3,
    openQuotesValue: 42800,
    deliveryReliabilityPct: 96.0,
    contacts: [
      {
        id: "c-ap-1",
        name: "Marcus Vance",
        role: "Procurement",
        title: "Lead Estimator & Buyer",
        phone: "+1 (312) 555-0142",
        email: "mvance@apexframing.com",
        isPrimary: true,
        avatarInitials: "MV"
      }
    ],
    conversationPlan: {
      meetingObjective: "Lock in Quote Q-410 ($42,800) before price protection expires at 5:00 PM today.",
      openWith: "Marcus, Branch Director David Kim signed off on the 8% margin exception for Q-410. I sent you the 1-click digital accept link so you can secure inventory before 5 PM.",
      keyQuestionsToAsk: [
        "Do you want White Cap to hold the 80 boxes of wedge anchors at Branch #12 for Monday pickup?",
        "Are framing clips needed for the East Wing framing starting next Thursday?"
      ],
      discussionTopics: [
        "Quote Q-410 ($42,800) locked with 8% discount.",
        "Stock physically available across Branch #12 and Branch #14."
      ],
      topicsToAvoid: [
        "Do not offer further discounts beyond the approved 8%."
      ],
      recommendedNextStep: "Send 1-click e-sign link via SMS and email.",
      isApproved: true
    },
    orders: [],
    quotes: [
      {
        id: "q-410",
        quoteNumber: "Q-410",
        title: "Structural Framing Fasteners & Anchors Package",
        totalAmount: 42800,
        discountPct: 8,
        marginPct: 27.2,
        status: "Approved",
        validUntil: "Today, 5:00 PM",
        lineItems: [
          { sku: "CON-ANCH-20", name: "Heavy-Duty 1/2in x 7in Wedge Anchors (Box of 25)", quantity: 80, unitPrice: 320, subtotal: 25600 },
          { sku: "FRM-FAST-08", name: "Structural Framing Clips & Hardware Fasteners", quantity: 40, unitPrice: 430, subtotal: 17200 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "Today, 8:15 AM",
      recentlyViewedCategories: ["Wedge Anchors", "Framing Hardware"]
    },
    serviceCases: [],
    evidenceHistory: [
      { title: "Margin Approved", detail: "David Kim signed off 8% exception.", timestamp: "Yesterday, 4:30 PM", source: "Pricing Authority" }
    ]
  },
  metro: {
    id: "metro",
    name: "Metro Foundations",
    tier: "Core",
    industry: "Deep Foundations & Earth Retention",
    region: "Midwest District (Branch #12)",
    headquarters: "Chicago, IL",
    accountManager: "Alex Miller",
    annualSpend: 520000,
    spendTrendPct: 4.2,
    healthScore: 92,
    healthStatus: "Healthy",
    openOrdersCount: 1,
    openQuotesValue: 18200,
    deliveryReliabilityPct: 98.0,
    contacts: [
      {
        id: "c-mt-1",
        name: "Elena Rostova",
        role: "Engineering",
        title: "Project Engineering Lead",
        phone: "+1 (312) 555-0187",
        email: "elena@metrofoundations.com",
        isPrimary: true,
        avatarInitials: "ER"
      }
    ],
    conversationPlan: {
      meetingObjective: "Transmit ASTM C881 epoxy rebar doweling engineering submittal package by 3:00 PM.",
      openWith: "Elena, our White Cap technical engineering specialist completed the shear-stress calculations for your rebar dowels.",
      keyQuestionsToAsk: [
        "Does the inspector require wet-hole installation certification for the epoxy?",
        "When is the foundation slab inspection scheduled?"
      ],
      discussionTopics: [
        "ASTM C881 Grade 3 epoxy submittal signed and verified.",
        "Stock reserved at Branch #12 for Thursday delivery."
      ],
      topicsToAvoid: [],
      recommendedNextStep: "Transmit PDF packet and close field commitment.",
      isApproved: true
    },
    orders: [],
    quotes: [],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "Yesterday",
      recentlyViewedCategories: ["Epoxy Adhesives", "Rebar Couplers"]
    },
    serviceCases: [],
    evidenceHistory: []
  },
  summit: {
    id: "summit",
    name: "Summit Commercial Builders",
    tier: "Enterprise",
    industry: "Commercial & Industrial General Contracting",
    region: "Chicago Metro & Midwest",
    headquarters: "Chicago, IL",
    accountManager: "Maya Chen",
    annualSpend: 1840000,
    spendTrendPct: 14.2,
    healthScore: 78,
    healthStatus: "Healthy",
    openOrdersCount: 4,
    openQuotesValue: 84600,
    deliveryReliabilityPct: 94.5,
    contacts: [
      {
        id: "c-1",
        name: "Jordan Lee",
        role: "Procurement",
        title: "VP of Procurement & Estimating",
        phone: "+1 (312) 555-0194",
        email: "jordan.lee@summitbuilders.com",
        isPrimary: true,
        avatarInitials: "JL"
      },
      {
        id: "c-2",
        name: "Alex Soto",
        role: "Jobsite Operations",
        title: "Senior Project Superintendent",
        phone: "+1 (312) 555-0198",
        email: "asoto@summitbuilders.com",
        avatarInitials: "AS"
      },
      {
        id: "c-3",
        name: "Clara Hughes",
        role: "Finance / Accounts Payable",
        title: "Director of Accounts Payable",
        phone: "+1 (312) 555-0144",
        email: "chughes@summitbuilders.com",
        avatarInitials: "CH"
      }
    ],
    conversationPlan: {
      meetingObjective: "Confirm whether Phase 2 of the West Loop Tower requires concrete accessory replenishment and secure agreement on the $84,600 open quote (Q-18719).",
      openWith: "Jordan, I wanted to close the loop on this morning's confirmed replacement shipment and check how the crew is pacing toward next week's pour.",
      keyQuestionsToAsk: [
        "What quantities will Phase 2 require for forms and tie wire?",
        "When does Alex Soto's crew need the first drop on the Michigan Ave site?",
        "Does Quote Q-18719 ($84,600) still reflect your latest structural engineering revisions?"
      ],
      discussionTopics: [
        "Quote Q-18719 ($84,600) pricing is locked and protected through October 10.",
        "Local branch in Chicago Central has reserved 300 units of formwork pins.",
        "One delivery exception from yesterday was successfully resolved by customer care at 7:28 AM."
      ],
      topicsToAvoid: [
        "Do NOT tell Jordan they are about to run out of materials (on-site inventory is unconfirmed).",
        "Do NOT mention price increases planned for November unless asked directly."
      ],
      recommendedNextStep: "Secure written approval for Q-18719 with scheduled delivery for next Tuesday.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-1",
        orderNumber: "O-10489",
        type: "Standard Purchase Order",
        amount: 32480,
        currency: "USD",
        orderState: "Processing",
        shipmentState: "In Transit",
        orderDate: "Oct 4, 2026",
        lineItemCount: 18,
        deliveryAddress: "West Loop Tower Site, 300 S Wacker, Chicago, IL"
      },
      {
        id: "ord-2",
        orderNumber: "O-10248",
        type: "Replenishment Order",
        amount: 41200,
        currency: "USD",
        orderState: "Completed",
        shipmentState: "Delivered",
        orderDate: "Jul 18, 2026",
        lineItemCount: 24,
        deliveryAddress: "Central Yard, 1200 S Michigan Ave, Chicago, IL"
      },
      {
        id: "ord-3",
        orderNumber: "O-09842",
        type: "Project Initial Phase",
        amount: 68400,
        currency: "USD",
        orderState: "Completed",
        shipmentState: "Delivered",
        orderDate: "Apr 22, 2026",
        lineItemCount: 36,
        deliveryAddress: "West Loop Tower Site, 300 S Wacker, Chicago, IL"
      }
    ],
    quotes: [
      {
        id: "q-1",
        quoteNumber: "Q-18719",
        title: "West Loop Tower Phase 2 Concrete Accessories Package",
        totalAmount: 84600,
        discountPct: 8,
        marginPct: 24.5,
        status: "In Review",
        validUntil: "Oct 10, 2026",
        lineItems: [
          { sku: "CA-1002", name: "Heavy Duty Snap Ties (12 in, Box of 100)", quantity: 40, unitPrice: 420, subtotal: 16800 },
          { sku: "CA-1044", name: "Formwork Alignment Brackets (Set of 4)", quantity: 30, unitPrice: 750, subtotal: 22500 },
          { sku: "RB-5020", name: "Grade 60 Deformed Rebar Dowels (#4 x 24 in)", quantity: 500, unitPrice: 90.6, subtotal: 45300 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: true,
      activeCartTotal: 6240,
      activeCartItemCount: 4,
      lastPortalVisit: "Yesterday at 6:40 PM",
      recentlyViewedCategories: ["Concrete Vibrators", "Safety Harnesses", "Curing Blankets"],
      abandonedQuote: {
        quoteNumber: "Q-18602",
        value: 14200,
        abandonedDaysAgo: 5
      }
    },
    serviceCases: [
      {
        id: "cs-1",
        caseNumber: "CASE-4408",
        subject: "Replacement shipment confirmation for Order O-10489",
        priority: "High",
        status: "Resolved",
        assignedSpecialist: "Ava Brooks (Customer Care)",
        openedDate: "Yesterday, 3:15 PM",
        resolvedDate: "Today, 7:28 AM",
        resolutionNote: "Replacement pallets allocated from Chicago Central Hub. Freight carrier confirmed delivery window for Tuesday 9:00 AM.",
        blocksSalesOutreach: false
      }
    ],
    evidenceHistory: [
      { title: "Order O-10248", detail: "Concrete accessories ordered 78 days ago. Historical replenishment is 90 days.", timestamp: "8:04 AM", source: "ERP Connect" },
      { title: "Quote Q-18719", detail: "$84,600 valid through Oct 10 with 8% discount approved.", timestamp: "8:02 AM", source: "Commerce Engine" },
      { title: "Customer Care Case CASE-4408", detail: "Replacement shipment confirmed for Tuesday. Customer sentiment positive.", timestamp: "7:28 AM", source: "Customer Care Queue" }
    ]
  },

  metro_siteworks: {
    id: "metro_siteworks",
    name: "Metro Siteworks",
    tier: "Strategic",
    industry: "Excavation, Civil Engineering & Utilities",
    region: "Northern Illinois",
    headquarters: "Naperville, IL",
    accountManager: "Maya Chen",
    annualSpend: 640000,
    spendTrendPct: 8.5,
    healthScore: 84,
    healthStatus: "Healthy",
    openOrdersCount: 2,
    openQuotesValue: 42800,
    deliveryReliabilityPct: 96.2,
    contacts: [
      {
        id: "c-metro-1",
        name: "Marcus Vance",
        role: "Procurement",
        title: "Senior Estimator & Lead Buyer",
        phone: "+1 (312) 555-0142",
        email: "mvance@metrositeworks.com",
        isPrimary: true,
        avatarInitials: "MV"
      },
      {
        id: "c-metro-2",
        name: "Tyler Ross",
        role: "Field Superintendent",
        title: "Civil Utilities Supervisor",
        phone: "+1 (312) 555-0148",
        email: "tross@metrositeworks.com",
        avatarInitials: "TR"
      }
    ],
    conversationPlan: {
      meetingObjective: "Notify Marcus that backordered geotextile rolls and shoring jacks have arrived at Chicago Central, and close Quote Q-18442.",
      openWith: "Marcus, great news—the heavy-duty trench shoring jacks and drainage rolls that held up Q-18442 cleared the dock this morning.",
      keyQuestionsToAsk: [
        "Can your utility crew accept delivery on the Naperville bypass site this Friday?",
        "Do you need additional trench safety boxes added to this order?"
      ],
      discussionTopics: [
        "Quote Q-18442 ($42,800) pricing is protected through Friday.",
        "Both line items are confirmed in stock with 32 units available."
      ],
      topicsToAvoid: [
        "Do not offer an additional discount beyond the pre-approved 5%."
      ],
      recommendedNextStep: "Release and email updated quote package with guaranteed Friday delivery.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-m1",
        orderNumber: "O-10312",
        type: "Civil Drainage Package",
        amount: 28900,
        currency: "USD",
        orderState: "Completed",
        shipmentState: "Delivered",
        orderDate: "Sep 12, 2026",
        lineItemCount: 12,
        deliveryAddress: "Route 59 Extension Site, Naperville, IL"
      }
    ],
    quotes: [
      {
        id: "q-m1",
        quoteNumber: "Q-18442",
        title: "Utility Trench Safety & Geotextiles Package",
        totalAmount: 42800,
        discountPct: 5,
        marginPct: 22.8,
        status: "Ready to Send",
        validUntil: "Friday, Oct 9",
        lineItems: [
          { sku: "ST-8821", name: "Reinforced Drainage Geosynthetic Roll (300 ft)", quantity: 24, unitPrice: 1250, subtotal: 30000 },
          { sku: "CV-4091", name: "Heavy-Duty Trench Shoring Jacks (8 ft)", quantity: 12, unitPrice: 1066.67, subtotal: 12800 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "3 days ago",
      recentlyViewedCategories: ["Trench Shoring", "Culvert Pipes"]
    },
    serviceCases: [],
    evidenceHistory: [
      { title: "Inventory Restock", detail: "SKU ST-8821 arrived at Chicago Central Hub (Bay 4).", timestamp: "7:45 AM", source: "WMS Inventory" },
      { title: "Quote Pricing Valid", detail: "Q-18442 pricing remains valid through Friday.", timestamp: "7:50 AM", source: "Pricing Matrix" }
    ]
  },

  cedar: {
    id: "cedar",
    name: "Cedar Ridge Builders",
    tier: "Strategic",
    industry: "Multi-Family Residential Framing & Envelopes",
    region: "Suburban Chicago",
    headquarters: "Schaumburg, IL",
    accountManager: "Maya Chen",
    annualSpend: 890000,
    spendTrendPct: -4.8,
    healthScore: 42,
    healthStatus: "Service Hold",
    openOrdersCount: 3,
    openQuotesValue: 56000,
    deliveryReliabilityPct: 81.0,
    contacts: [
      {
        id: "c-cedar-1",
        name: "Greg Thornton",
        role: "Executive / Operations",
        title: "VP Construction Operations",
        phone: "+1 (312) 555-0176",
        email: "gthornton@cedarridgebuilders.com",
        isPrimary: true,
        avatarInitials: "GT"
      },
      {
        id: "c-cedar-2",
        name: "Danielle Murphy",
        role: "Site Superintendent",
        title: "Senior Superintendent - West Ridge Project",
        phone: "+1 (312) 555-0179",
        email: "dmurphy@cedarridgebuilders.com",
        avatarInitials: "DM"
      }
    ],
    conversationPlan: {
      meetingObjective: "OUTBOUND OUTREACH PROHIBITED. Sales outreach is paused under Governance Policy while Customer Care resolves Case CASE-4412.",
      openWith: "If Greg calls in: 'Greg, our engineering specialist is actively testing the replacement load anchors right now. Ava Brooks and I are tracking this by the hour.'",
      keyQuestionsToAsk: [
        "Only answer inbound inquiries regarding test results and ASTM load compliance."
      ],
      discussionTopics: [
        "Acknowledge the fastener failure and emphasize company-level engineering support."
      ],
      topicsToAvoid: [
        "STRICTLY PROHIBITED: Do not pitch upcoming phases, promotions, or renewal terms until this case is resolved."
      ],
      recommendedNextStep: "Monitor Customer Care queue and contact Greg ONLY when Ava Brooks confirms full ASTM engineering sign-off.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-c1",
        orderNumber: "O-10398",
        type: "Framing Fasteners & Anchor Package",
        amount: 22400,
        currency: "USD",
        orderState: "Exception",
        shipmentState: "Exception",
        orderDate: "Oct 1, 2026",
        lineItemCount: 15,
        deliveryAddress: "West Ridge Multi-Family Site, Schaumburg, IL"
      }
    ],
    quotes: [
      {
        id: "q-c1",
        quoteNumber: "Q-18510",
        title: "Phase 3 Roof Trusses & Structural Framing Package",
        totalAmount: 56000,
        discountPct: 6,
        marginPct: 23.0,
        status: "In Review",
        validUntil: "Oct 20, 2026",
        lineItems: [
          { sku: "TR-900", name: "Engineered Timber Truss Connectors", quantity: 120, unitPrice: 300, subtotal: 36000 },
          { sku: "FN-440", name: "Heavy Duty Anchor Bolts (1/2 in x 10 in)", quantity: 200, unitPrice: 100, subtotal: 20000 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "Yesterday",
      recentlyViewedCategories: ["Structural Anchors", "Inspection Submittals"]
    },
    serviceCases: [
      {
        id: "cs-cedar-1",
        caseNumber: "CASE-4412",
        subject: "Critical Product substitution requires specialist engineering review",
        priority: "Urgent",
        status: "In Progress",
        assignedSpecialist: "Ava Brooks (Customer Care)",
        openedDate: "Today, 7:15 AM",
        resolutionNote: "Substituted anchor bolts did not meet jobsite inspector shear load test. Engineering team is expediting ASTM certified replacement lot.",
        blocksSalesOutreach: true,
        blockReason: "Customer relationship at risk. Promotional calls placed on hold by Sales Governance policy until case CASE-4412 is resolved."
      }
    ],
    evidenceHistory: [
      { title: "Governance Outreach Hold", detail: "Outreach automatically paused due to Urgent Severity defect CASE-4412.", timestamp: "7:20 AM", source: "Sales Governance Engine" },
      { title: "Defect Logged", detail: "Fastener shear failure reported on West Ridge jobsite.", timestamp: "7:15 AM", source: "Customer Care Queue" }
    ]
  },

  lakeside: {
    id: "lakeside",
    name: "Lakeside Concrete",
    tier: "Core",
    industry: "Ready-Mix & Precast Concrete Manufacturing",
    region: "Gary & South Chicago",
    headquarters: "Gary, IN",
    accountManager: "Maya Chen",
    annualSpend: 410000,
    spendTrendPct: 2.1,
    healthScore: 74,
    healthStatus: "Attention Needed",
    openOrdersCount: 1,
    openQuotesValue: 18500,
    deliveryReliabilityPct: 91.0,
    contacts: [
      {
        id: "c-lake-1",
        name: "Elena Rostova",
        role: "Dispatch & Plant Operations",
        title: "Operations & Dispatch Manager",
        phone: "+1 (312) 555-0187",
        email: "elena@lakesideconcrete.com",
        isPrimary: true,
        avatarInitials: "ER"
      }
    ],
    conversationPlan: {
      meetingObjective: "Confirm Tuesday delivery window for 40 tons of Portland cement before the 3:00 PM commitment deadline.",
      openWith: "Elena, I have carrier dispatch confirmation in hand for your 40-ton cement drop on Tuesday morning.",
      keyQuestionsToAsk: [
        "Will your Gary silo be cleared to receive the pneumatic discharge by 8:30 AM?",
        "Do you need additional accelerator additives included on this truck?"
      ],
      discussionTopics: [
        "Carrier route confirmed with Truck #4489 scheduled for 8:00 AM departure."
      ],
      topicsToAvoid: [
        "Do not promise delivery time tighter than a 2-hour window."
      ],
      recommendedNextStep: "Send written confirmation email and log commitment fulfillment.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-l1",
        orderNumber: "O-10492",
        type: "Bulk Portland Cement",
        amount: 18500,
        currency: "USD",
        orderState: "Processing",
        shipmentState: "Preparing",
        orderDate: "Yesterday",
        lineItemCount: 1,
        deliveryAddress: "Gary Batch Plant #2, Gary, IN"
      }
    ],
    quotes: [],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "Yesterday",
      recentlyViewedCategories: ["Cement Admixtures", "Curing Compounds"]
    },
    serviceCases: [],
    evidenceHistory: [
      { title: "Commitment Deadline", detail: "Customer promise due by 3:00 PM CST.", timestamp: "8:00 AM", source: "Commitment Tracker" }
    ]
  },

  northstar: {
    id: "northstar",
    name: "NorthStar Roofing",
    tier: "Core",
    industry: "Commercial Flat Roofing & Sheet Metal",
    region: "Rockford & Northwest IL",
    headquarters: "Rockford, IL",
    accountManager: "Maya Chen",
    annualSpend: 310000,
    spendTrendPct: 4.0,
    healthScore: 82,
    healthStatus: "Healthy",
    openOrdersCount: 1,
    openQuotesValue: 18200,
    deliveryReliabilityPct: 98.0,
    contacts: [
      {
        id: "c-ns-1",
        name: "Derek Miller",
        role: "Safety & Equipment",
        title: "Safety & Site Equipment Director",
        phone: "+1 (312) 555-0119",
        email: "dmiller@northstarroofing.com",
        isPrimary: true,
        avatarInitials: "DM"
      }
    ],
    conversationPlan: {
      meetingObjective: "Verify upcoming replenishment demand for safety consumables (harnesses, lanyards, anchor points).",
      openWith: "Derek, based on your typical 60-day equipment cycle, your crews are likely nearing their next safety harness and rope grab refresh.",
      keyQuestionsToAsk: [
        "How many active roofing crews are deployed on the Rockford logistics center project?",
        "Do your harnesses need OSHA 2026 compliant submittal tags?"
      ],
      discussionTopics: [
        "Standard warehouse lead time is 9 business days; ordering now guarantees stock before the next safety audit."
      ],
      topicsToAvoid: [
        "Do not assume reorder without checking on-site crew sizes."
      ],
      recommendedNextStep: "Draft reorder package for 24 harness kits and email for sign-off.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-ns1",
        orderNumber: "O-10118",
        type: "Safety Consumables Package",
        amount: 16800,
        currency: "USD",
        orderState: "Completed",
        shipmentState: "Delivered",
        orderDate: "Aug 15, 2026",
        lineItemCount: 8,
        deliveryAddress: "NorthStar Central Warehouse, Rockford, IL"
      }
    ],
    quotes: [
      {
        id: "q-ns1",
        quoteNumber: "Q-18690",
        title: "Q4 Safety Harness & Consumables Package",
        totalAmount: 18200,
        discountPct: 4,
        marginPct: 26.5,
        status: "Draft",
        validUntil: "Oct 25, 2026",
        lineItems: [
          { sku: "SF-440", name: "Full Body Construction Harness (Class A)", quantity: 24, unitPrice: 380, subtotal: 9120 },
          { sku: "SF-550", name: "Shock Absorbing Lanyards (6 ft)", quantity: 48, unitPrice: 189.17, subtotal: 9080 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "3 days ago",
      recentlyViewedCategories: ["Roofing Adhesives", "Fall Protection"]
    },
    serviceCases: [],
    evidenceHistory: [
      { title: "Cadence Trigger", detail: "Day 58 of typical 60-day reorder cycle reached.", timestamp: "8:00 AM", source: "Replenishment Engine" }
    ]
  },

  apex_infra: {
    id: "apex_infra",
    name: "Apex Infrastructure Partners",
    tier: "Enterprise",
    industry: "Heavy Highway, Bridges & Municipal Infrastructure",
    region: "Midwest Transportation Corridors",
    headquarters: "Peoria, IL",
    accountManager: "Maya Chen",
    annualSpend: 1450000,
    spendTrendPct: -18.4,
    healthScore: 52,
    healthStatus: "At Risk",
    openOrdersCount: 0,
    openQuotesValue: 0,
    deliveryReliabilityPct: 89.0,
    contacts: [
      {
        id: "c-apex-1",
        name: "Brenda Keller",
        role: "Procurement",
        title: "VP Heavy Highway Procurement",
        phone: "+1 (312) 555-0163",
        email: "bkeller@apexinfra.com",
        isPrimary: true,
        avatarInitials: "BK"
      }
    ],
    conversationPlan: {
      meetingObjective: "Conduct account retention review. Investigate why bi-weekly orders dropped off for 31 days.",
      openWith: "Brenda, looking at our procurement history, Apex typically orders bridge geotextiles and dowels every two weeks, but we haven't seen an order in a month. Wanted to check if project schedules shifted or if you had any issues with the last lot.",
      keyQuestionsToAsk: [
        "Did upcoming I-80 corridor bids get awarded, or are state approvals delayed?",
        "Were there any pricing or delivery discrepancies on the August shipments?"
      ],
      discussionTopics: [
        "Express commitment to match competitive price points on volume rebar lots."
      ],
      topicsToAvoid: [
        "Do not sound accusatory; focus on operational support."
      ],
      recommendedNextStep: "Schedule 20-minute executive check-in with Brenda and regional VP.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-a1",
        orderNumber: "O-10190",
        type: "Highway Dowels & Joint Sealant",
        amount: 44200,
        currency: "USD",
        orderState: "Completed",
        shipmentState: "Delivered",
        orderDate: "Sep 14, 2026",
        lineItemCount: 14,
        deliveryAddress: "I-80 Section 4 Corridor Yard, Joliet, IL"
      }
    ],
    quotes: [],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "12 days ago",
      recentlyViewedCategories: ["Highway Rebar", "Expansion Joints"]
    },
    serviceCases: [],
    evidenceHistory: [
      { title: "Velocity Alert", detail: "31 days elapsed since last purchase. Historical cadence was 14 days.", timestamp: "8:00 AM", source: "Churn Detection Radar" }
    ]
  },

  volttech: {
    id: "volttech",
    name: "VoltTech Industrial Power & Automation",
    tier: "Enterprise",
    industry: "Electrical Equipment, Switchgear & Automation",
    region: "Great Lakes & Upper Midwest",
    headquarters: "Milwaukee, WI",
    accountManager: "Maya Chen",
    annualSpend: 2180000,
    spendTrendPct: 16.8,
    healthScore: 86,
    healthStatus: "Healthy",
    openOrdersCount: 2,
    openQuotesValue: 114000,
    deliveryReliabilityPct: 97.4,
    contacts: [
      {
        id: "c-vt-1",
        name: "Sarah Lin",
        role: "Procurement",
        title: "VP of Engineering Procurement",
        phone: "+1 (414) 555-0129",
        email: "slin@volttechpower.com",
        isPrimary: true,
        avatarInitials: "SL"
      },
      {
        id: "c-vt-2",
        name: "Jason Cole",
        role: "Project Engineering",
        title: "Lead Industrial Automation Engineer",
        phone: "+1 (414) 555-0133",
        email: "jcole@volttechpower.com",
        avatarInitials: "JC"
      }
    ],
    conversationPlan: {
      meetingObjective: "Finalize quote Q-18920 for the $114K Motor Control Center and switchgear package for the Kenosha plant expansion.",
      openWith: "Sarah, our electrical engineering team validated the UL-508A compliance submittal for your Kenosha expansion project this week.",
      keyQuestionsToAsk: [
        "What is your target commissioning date for the main motor control distribution line?",
        "Do you need factory pre-wiring completed before jobsite delivery?"
      ],
      discussionTopics: [
        "Quote Q-18920 ($114,000) includes guaranteed 4-week factory lead time.",
        "Local branch in Milwaukee has 500 MCM copper feeder spools reserved."
      ],
      topicsToAvoid: [
        "Do not offer extended Net-90 credit terms without credit committee sign-off."
      ],
      recommendedNextStep: "Secure signed PO for Q-18920 to reserve factory production slot.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-vt1",
        orderNumber: "O-10520",
        type: "Electrical Feeder & Conduit Package",
        amount: 76400,
        currency: "USD",
        orderState: "Processing",
        shipmentState: "In Transit",
        orderDate: "Oct 2, 2026",
        lineItemCount: 22,
        deliveryAddress: "Kenosha Automation Plant, Kenosha, WI"
      }
    ],
    quotes: [
      {
        id: "q-vt1",
        quoteNumber: "Q-18920",
        title: "Motor Control Center & 600V Switchgear Package",
        totalAmount: 114000,
        discountPct: 7,
        marginPct: 27.5,
        status: "Ready to Send",
        validUntil: "Oct 28, 2026",
        lineItems: [
          { sku: "MCC-500", name: "UL-508A Motor Control Center Section (480V)", quantity: 2, unitPrice: 38000, subtotal: 76000 },
          { sku: "CB-600", name: "Electronic Trip Molded Case Circuit Breakers (600A)", quantity: 4, unitPrice: 9500, subtotal: 38000 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: true,
      activeCartTotal: 8400,
      activeCartItemCount: 6,
      lastPortalVisit: "Yesterday at 4:10 PM",
      recentlyViewedCategories: ["VFD Drives", "Industrial Enclosures", "Ethernet Switches"]
    },
    serviceCases: [],
    evidenceHistory: [
      { title: "Engineering Sign-off", detail: "UL-508A drawing submittal approved by applications engineer.", timestamp: "9:15 AM", source: "Technical Desk" }
    ]
  },

  omnipack: {
    id: "omnipack",
    name: "OmniPack Industrial Supply",
    tier: "Strategic",
    industry: "Packaging Automation, Machinery & Corrugated Supplies",
    region: "Michigan & Ohio Valley",
    headquarters: "Grand Rapids, MI",
    accountManager: "Maya Chen",
    annualSpend: 760000,
    spendTrendPct: 9.2,
    healthScore: 82,
    healthStatus: "Healthy",
    openOrdersCount: 2,
    openQuotesValue: 38400,
    deliveryReliabilityPct: 98.2,
    contacts: [
      {
        id: "c-op-1",
        name: "Dave Kowalski",
        role: "Operations",
        title: "VP of Plant Operations & Supply Chain",
        phone: "+1 (616) 555-0182",
        email: "dkowalski@omnipacksupply.com",
        isPrimary: true,
        avatarInitials: "DK"
      }
    ],
    conversationPlan: {
      meetingObjective: "Present automated high-speed stretch wrapping machine upgrade proposal (Q-18750).",
      openWith: "Dave, I reviewed your Grand Rapids facility throughput numbers—the automated turntable wrapper we quoted can cut film waste by 28%.",
      keyQuestionsToAsk: [
        "What is your peak pallet throughput per shift heading into Q4?",
        "Are your operators looking for automatic film-cut and wipe-down features?"
      ],
      discussionTopics: [
        "Quote Q-18750 ($38,400) includes installation, calibration, and 1-year preventive maintenance."
      ],
      topicsToAvoid: [
        "Do not offer trade-in allowance on existing machinery without inspection."
      ],
      recommendedNextStep: "Schedule 30-minute machinery live demonstration at regional demo center.",
      isApproved: false
    },
    orders: [
      {
        id: "ord-op1",
        orderNumber: "O-10388",
        type: "High-Performance Stretch Film Lots",
        amount: 28500,
        currency: "USD",
        orderState: "Completed",
        shipmentState: "Delivered",
        orderDate: "Sep 20, 2026",
        lineItemCount: 16,
        deliveryAddress: "OmniPack Logistics Distribution Center, Grand Rapids, MI"
      }
    ],
    quotes: [
      {
        id: "q-op1",
        quoteNumber: "Q-18750",
        title: "Automated Rotary Turntable Stretch Wrapper Package",
        totalAmount: 38400,
        discountPct: 5,
        marginPct: 29.0,
        status: "Submitted",
        validUntil: "Nov 5, 2026",
        lineItems: [
          { sku: "PK-WRAP-800", name: "High-Speed Automated Stretch Wrapper (5000 lb capacity)", quantity: 1, unitPrice: 32000, subtotal: 32000 },
          { sku: "PK-FILM-90", name: "Pre-Stretch Machine Film Rolls (80 Gauge, 40 Rolls)", quantity: 2, unitPrice: 3200, subtotal: 6400 }
        ]
      }
    ],
    digitalSignals: {
      hasActiveCart: false,
      lastPortalVisit: "4 days ago",
      recentlyViewedCategories: ["Automated Strapping", "Heavy-Duty Pallet Wrappers"]
    },
    serviceCases: [],
    evidenceHistory: [
      { title: "Quote Prepared", detail: "Machinery specification Q-18750 generated with equipment application notes.", timestamp: "8:00 AM", source: "Commerce Engine" }
    ]
  }
};
