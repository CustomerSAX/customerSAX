import type { Quote } from "./types/quote-types";

export interface EnrichedQuote extends Quote {
  accountId: string;
  accountName: string;
  industry: string;
  primaryContact: {
    name: string;
    role: string;
    email: string;
    avatarInitials: string;
  };
  marginPct: number;
  targetMarginPct: number;
  daysUntilExpiration: number;
  urgency: "urgent" | "normal" | "closed";
  approvalRequest?: {
    requestedDiscountPct: number;
    requestedBy: string;
    reason: string;
    requestedAt: string;
    status: "Pending" | "Approved" | "Countered" | "Declined";
    managerNote?: string;
  };
}

export const initialQuotes: EnrichedQuote[] = [
  {
    id: "Q-18719",
    quoteNumber: "Q-18719",
    companyId: "summit",
    companyName: "Summit Commercial Builders",
    accountId: "summit",
    accountName: "Summit Commercial Builders",
    industry: "Commercial Construction",
    primaryContact: {
      name: "Jordan Lee",
      role: "Purchasing Director",
      email: "jordan.lee@summitbuilders.com",
      avatarInitials: "JL"
    },
    status: "In Review",
    approvalStatus: "Approved",
    subtotal: 84600,
    discountPct: 8,
    negotiatedTotal: 77832,
    marginPct: 22.4,
    targetMarginPct: 22.0,
    daysUntilExpiration: 4,
    validUntil: "Oct 20, 2026",
    urgency: "normal",
    createdAt: "Oct 12, 2026",
    lastModifiedAt: "Today at 8:00 AM",
    lineItems: [
      {
        id: "LI-1",
        sku: "CONC-REBAR-12MM",
        name: "Grade 60 Deformed Steel Rebar Dowels (Pack of 50)",
        quantity: 120,
        listPrice: 420,
        negotiatedPrice: 386.4,
        subtotal: 46368,
        stockStatus: "In Stock",
        availableBranch: "Chicago Central DC"
      },
      {
        id: "LI-2",
        sku: "CONC-TIE-DOWEL-18",
        name: "Heavy-Duty Epoxy-Coated Form Ties (18-Inch)",
        quantity: 250,
        listPrice: 152.92,
        negotiatedPrice: 125.85,
        subtotal: 31464,
        stockStatus: "In Stock",
        availableBranch: "Chicago Central DC"
      }
    ],
    negotiationTurns: [
      {
        id: "NT-1",
        authorRole: "Buyer",
        authorName: "Jordan Lee",
        comment: "Can we get 8% if we issue the PO for Phase 2 before Friday?",
        timestamp: "Oct 12, 2026"
      },
      {
        id: "NT-2",
        authorRole: "Seller",
        authorName: "Maya Chen",
        comment: "Approved 8% bundle rate with Chicago warehouse inventory reserved.",
        timestamp: "Oct 13, 2026"
      }
    ]
  },
  {
    id: "Q-18442",
    quoteNumber: "Q-18442",
    companyId: "volttech",
    companyName: "VoltTech Automation Systems",
    accountId: "volttech",
    accountName: "VoltTech Automation Systems",
    industry: "Industrial Electrical & Robotics",
    primaryContact: {
      name: "Dave Miller",
      role: "VP of Engineering",
      email: "dmiller@volttechauto.com",
      avatarInitials: "DM"
    },
    status: "Submitted",
    approvalStatus: "None",
    subtotal: 19368,
    discountPct: 5,
    negotiatedTotal: 18400,
    marginPct: 24.5,
    targetMarginPct: 20.0,
    daysUntilExpiration: 6,
    validUntil: "Oct 22, 2026",
    urgency: "urgent",
    unblockedReason: "120 units of Siemens G120C drives restocked at Chicago DC this morning",
    createdAt: "Oct 10, 2026",
    lastModifiedAt: "Today at 7:52 AM",
    lineItems: [
      {
        id: "LI-3",
        sku: "ELEC-DRIVE-G120",
        name: "Siemens Sinamics G120C Compact Inverter Drive (15HP)",
        quantity: 12,
        listPrice: 1450,
        negotiatedPrice: 1377.5,
        subtotal: 16530,
        stockStatus: "In Stock",
        availableBranch: "Chicago DC (Restocked)"
      },
      {
        id: "LI-4",
        sku: "ELEC-RELAY-24V",
        name: "Finder 24V DC Industrial Interface Relay Modules",
        quantity: 40,
        listPrice: 46.7,
        negotiatedPrice: 46.75,
        subtotal: 1870,
        stockStatus: "In Stock",
        availableBranch: "Chicago DC"
      }
    ]
  },
  {
    id: "Q-19041",
    quoteNumber: "Q-19041",
    companyId: "omnipack",
    companyName: "OmniPack Industrial Solutions",
    accountId: "omnipack",
    accountName: "OmniPack Industrial Solutions",
    industry: "Packaging Automation",
    primaryContact: {
      name: "Sarah Jenkins",
      role: "Director of Procurement",
      email: "sjenkins@omnipackind.com",
      avatarInitials: "SJ"
    },
    status: "In Review",
    approvalStatus: "Pending Manager Approval",
    subtotal: 72954,
    discountPct: 12,
    negotiatedTotal: 64200,
    marginPct: 18.2,
    targetMarginPct: 21.0,
    daysUntilExpiration: 5,
    validUntil: "Oct 21, 2026",
    urgency: "urgent",
    createdAt: "Yesterday at 3:30 PM",
    approvalRequest: {
      requestedDiscountPct: 12,
      requestedBy: "Maya Chen (Sales AE)",
      reason: "Competitor (Grainger) offered 10% on film pallet contract. Sarah committed to 100% exclusivity if we match at 12%.",
      requestedAt: "Yesterday at 3:45 PM",
      status: "Pending"
    },
    lineItems: [
      {
        id: "LI-5",
        sku: "PKG-FILM-STRETCH-80G",
        name: "Ultra-High Performance Machine Cast Stretch Film (80 Gauge, 5000ft)",
        quantity: 180,
        listPrice: 355.3,
        negotiatedPrice: 312.66,
        subtotal: 56279,
        stockStatus: "In Stock",
        availableBranch: "Milwaukee DC"
      },
      {
        id: "LI-6",
        sku: "PKG-TAPE-ACRYLIC",
        name: "Vibac Heavy Duty Carton Sealing Tape (Clear, 36 Rolls/Case)",
        quantity: 35,
        listPrice: 220,
        negotiatedPrice: 193.6,
        subtotal: 6776,
        stockStatus: "In Stock",
        availableBranch: "Milwaukee DC"
      }
    ]
  },
  {
    id: "Q-17980",
    quoteNumber: "Q-17980",
    companyId: "metro",
    companyName: "Metro Siteworks & Utilities",
    accountId: "metro",
    accountName: "Metro Siteworks & Utilities",
    industry: "Civil Infrastructure",
    primaryContact: {
      name: "Marcus Vance",
      role: "Senior Estimator",
      email: "mvance@metrositeworks.com",
      avatarInitials: "MV"
    },
    status: "Submitted",
    approvalStatus: "Approved",
    subtotal: 45052,
    discountPct: 5,
    negotiatedTotal: 42800,
    marginPct: 23.1,
    targetMarginPct: 21.0,
    daysUntilExpiration: 2,
    validUntil: "Tomorrow · 5:00 PM CST",
    urgency: "urgent",
    createdAt: "Oct 9, 2026",
    lineItems: [
      {
        id: "LI-7",
        sku: "UTIL-TRENCH-BOX-10",
        name: "Aluminum Modular Trench Shoring Shield (8ft x 10ft)",
        quantity: 4,
        listPrice: 8500,
        negotiatedPrice: 8075,
        subtotal: 32300,
        stockStatus: "In Stock",
        availableBranch: "Chicago Central DC"
      },
      {
        id: "LI-8",
        sku: "UTIL-SPREADER-SETS",
        name: "Adjustable Steel Spreader Pipe Assembly (48in - 72in)",
        quantity: 12,
        listPrice: 921,
        negotiatedPrice: 875,
        subtotal: 10500,
        stockStatus: "In Stock",
        availableBranch: "Chicago Central DC"
      }
    ]
  },
  {
    id: "Q-18115",
    quoteNumber: "Q-18115",
    companyId: "apex",
    companyName: "Apex Modular Construction",
    accountId: "apex",
    accountName: "Apex Modular Construction",
    industry: "Offsite Modular",
    primaryContact: {
      name: "Greg Kowalski",
      role: "Project Executive",
      email: "gregk@apexmodular.com",
      avatarInitials: "GK"
    },
    status: "Converted",
    approvalStatus: "Approved",
    subtotal: 39247,
    discountPct: 7,
    negotiatedTotal: 36500,
    marginPct: 22.8,
    targetMarginPct: 20.0,
    daysUntilExpiration: 0,
    validUntil: "Oct 15, 2026 (Converted)",
    urgency: "closed",
    createdAt: "Oct 7, 2026",
    lastModifiedAt: "Yesterday at 11:30 AM",
    lineItems: [
      {
        id: "LI-9",
        sku: "MOD-INSUL-FOAM-R15",
        name: "Closed-Cell Spray Foam Insulation Kits (Commercial 600 Board-Ft)",
        quantity: 25,
        listPrice: 950,
        negotiatedPrice: 883.5,
        subtotal: 22087,
        stockStatus: "In Stock",
        availableBranch: "Aurora Branch"
      },
      {
        id: "LI-10",
        sku: "MOD-FAST-STRUCTURAL",
        name: "Simpson Strong-Tie Heavy Framing Anchor Fasteners (500ct)",
        quantity: 30,
        listPrice: 512,
        negotiatedPrice: 480.4,
        subtotal: 14412,
        stockStatus: "In Stock",
        availableBranch: "Aurora Branch"
      }
    ]
  },
  {
    id: "Q-19220",
    quoteNumber: "Q-19220",
    companyId: "cedar",
    companyName: "Cedar Valley Components",
    accountId: "cedar",
    accountName: "Cedar Valley Components",
    industry: "Precision Machining",
    primaryContact: {
      name: "Elena Rostova",
      role: "Supply Chain Manager",
      email: "erostova@cedarcomponents.com",
      avatarInitials: "ER"
    },
    status: "Draft",
    approvalStatus: "None",
    subtotal: 24361,
    discountPct: 6,
    negotiatedTotal: 22900,
    marginPct: 25.1,
    targetMarginPct: 22.0,
    daysUntilExpiration: 12,
    validUntil: "Oct 28, 2026",
    urgency: "normal",
    createdAt: "Oct 14, 2026",
    lineItems: [
      {
        id: "LI-11",
        sku: "MACH-COOLANT-SYNTH",
        name: "Castrol Syntilo High-Performance Synthetic Metalworking Fluid (55 Gal)",
        quantity: 8,
        listPrice: 1850,
        negotiatedPrice: 1739,
        subtotal: 13912,
        stockStatus: "In Stock",
        availableBranch: "Grand Rapids DC"
      },
      {
        id: "LI-12",
        sku: "MACH-INSERTS-CARBIDE",
        name: "Sandvik Coromant CNC Milling Carbide Inserts (10 Pack)",
        quantity: 35,
        listPrice: 320,
        negotiatedPrice: 300.8,
        subtotal: 10528,
        stockStatus: "In Stock",
        availableBranch: "Grand Rapids DC"
      }
    ]
  },
  {
    id: "Q-18550",
    quoteNumber: "Q-18550",
    companyId: "lakeside",
    companyName: "Lakeside Steel Fabricators",
    accountId: "lakeside",
    accountName: "Lakeside Steel Fabricators",
    industry: "Heavy Steel Fabrication",
    primaryContact: {
      name: "Tom Bradley",
      role: "Plant Operations Director",
      email: "tbradley@lakesidesteel.com",
      avatarInitials: "TB"
    },
    status: "Submitted",
    approvalStatus: "None",
    subtotal: 17200,
    discountPct: 7,
    negotiatedTotal: 16000,
    marginPct: 21.0,
    targetMarginPct: 20.0,
    daysUntilExpiration: 3,
    validUntil: "Oct 19, 2026",
    urgency: "normal",
    createdAt: "Oct 11, 2026",
    lineItems: [
      {
        id: "LI-13",
        sku: "STEEL-WELD-WIRE-70S",
        name: "Lincoln Electric ER70S-6 Solid Welding Wire Spool (44 lb)",
        quantity: 80,
        listPrice: 130,
        negotiatedPrice: 120.9,
        subtotal: 9672,
        stockStatus: "In Stock",
        availableBranch: "Milwaukee DC"
      },
      {
        id: "LI-14",
        sku: "STEEL-ABRASIVE-DISC",
        name: "Norton Quantum3 Grinding Wheels 7in (Box of 20)",
        quantity: 25,
        listPrice: 275,
        negotiatedPrice: 255.75,
        subtotal: 6393,
        stockStatus: "In Stock",
        availableBranch: "Milwaukee DC"
      }
    ]
  }
];
