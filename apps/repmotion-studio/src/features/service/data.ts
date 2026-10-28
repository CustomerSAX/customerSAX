export interface ServiceIncident {
  id: string;
  caseNumber: string;
  accountId: string;
  accountName: string;
  industry: string;
  primaryContact: {
    name: string;
    role: string;
    phone: string;
    email: string;
    avatarInitials: string;
  };
  orderNumber?: string;
  category: "damaged_shipment" | "delivery_delay" | "wrong_item" | "billing_dispute" | "technical_defect";
  categoryLabel: string;
  subject: string;
  description: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  status: "In Progress with Support" | "Pending Carrier Tracking" | "Resolved - Needs Rep Follow-up" | "Closed";
  assignedSpecialist: string; // e.g. Ava Brooks (Customer Care)
  openedAt: string;
  lastUpdated: string;
  blocksSalesOutreach: boolean;
  blockReason?: string;
  resolutionSummary?: string;
  executiveExpediteRequested?: boolean;
  salesFollowUpCompleted?: boolean;
  salesFollowUpNote?: string;
  goodwillCreditOffered?: string;
}

export const initialIncidents: ServiceIncident[] = [
  {
    id: "INC-4408",
    caseNumber: "CASE-4408",
    accountId: "summit",
    accountName: "Summit Commercial Builders",
    industry: "Commercial Construction",
    primaryContact: {
      name: "Jordan Lee",
      role: "Purchasing Director",
      phone: "+1 (312) 555-0194",
      email: "jordan.lee@summitbuilders.com",
      avatarInitials: "JL"
    },
    orderNumber: "O-10489",
    category: "damaged_shipment",
    categoryLabel: "Replacement Dispatched",
    subject: "Replacement shipment confirmed for cracked tie-rod dowels",
    description: "Jobsite reported 2 crates arrived with damaged banding and bent dowels during concrete pour prep.",
    priority: "High",
    status: "Resolved - Needs Rep Follow-up",
    assignedSpecialist: "Ava Brooks (Customer Care Specialist)",
    openedAt: "Yesterday at 1:15 PM",
    lastUpdated: "Today at 7:28 AM",
    blocksSalesOutreach: false,
    resolutionSummary: "Replacement shipment scheduled for delivery this morning at 8:30 AM via local hotshot courier. Proof of delivery signed by jobsite security.",
    salesFollowUpCompleted: false
  },
  {
    id: "INC-9182",
    caseNumber: "CASE-9182",
    accountId: "cedar",
    accountName: "Cedar Valley Components",
    industry: "Precision Machining & Aerospace Parts",
    primaryContact: {
      name: "Elena Rostova",
      role: "Supply Chain Manager",
      phone: "+1 (616) 555-0177",
      email: "erostova@cedarcomponents.com",
      avatarInitials: "ER"
    },
    orderNumber: "O-10521",
    category: "technical_defect",
    categoryLabel: "Surface Quality Defect",
    subject: "Surface-finish defect on Lot #882 titanium brackets",
    description: "Elena rejected 45 brackets due to micro-pitting on anodized surface. Threatening to put annual contract out to bid.",
    priority: "Urgent",
    status: "In Progress with Support",
    assignedSpecialist: "Ava Brooks (Customer Care Specialist)",
    openedAt: "Oct 15, 2026 at 3:45 PM",
    lastUpdated: "Today at 7:55 AM",
    blocksSalesOutreach: true,
    blockReason: "Active quality defect claim. All promotional sales outreach paused by Governance policy to protect relationship trust.",
    resolutionSummary: "Support team coordinated with QA metallurgy lab. $1,250 credit memo in accounting review. Sample replacement parts expedited."
  },
  {
    id: "INC-3891",
    caseNumber: "CASE-3891",
    accountId: "lakeside",
    accountName: "Lakeside Steel Fabricators",
    industry: "Heavy Steel Fabrication",
    primaryContact: {
      name: "Tom Bradley",
      role: "Plant Operations Director",
      phone: "+1 (414) 555-0198",
      email: "tbradley@lakesidesteel.com",
      avatarInitials: "TB"
    },
    orderNumber: "O-10319",
    category: "delivery_delay",
    categoryLabel: "Freight Transit Delay",
    subject: "LTL freight delay on Lincoln Electric welding wire spools",
    description: "Carrier Midwest Express experienced mechanical breakdown outside Milwaukee terminal. 24h delivery delay.",
    priority: "Medium",
    status: "In Progress with Support",
    assignedSpecialist: "Marcus Vance (Logistics Support Desk)",
    openedAt: "Yesterday at 4:10 PM",
    lastUpdated: "Today at 6:40 AM",
    blocksSalesOutreach: false,
    resolutionSummary: "Carrier re-routed shipment to secondary trailer. Expected arrival at Lakeside loading dock by 2:00 PM today."
  },
  {
    id: "INC-5020",
    caseNumber: "CASE-5020",
    accountId: "metro",
    accountName: "Metro Siteworks & Utilities",
    industry: "Civil Utilities & Underground",
    primaryContact: {
      name: "Marcus Vance",
      role: "Senior Estimator",
      phone: "+1 (312) 555-0142",
      email: "mvance@metrositeworks.com",
      avatarInitials: "MV"
    },
    orderNumber: "O-10118",
    category: "wrong_item",
    categoryLabel: "Wrong SKU Delivered",
    subject: "Incorrect spreader pipe diameter delivered to Michigan Ave jobsite",
    description: "Crate contained 48-inch spreaders instead of required 72-inch heavy wall assemblies.",
    priority: "High",
    status: "Resolved - Needs Rep Follow-up",
    assignedSpecialist: "Ava Brooks (Customer Care Specialist)",
    openedAt: "Oct 14, 2026",
    lastUpdated: "Oct 15, 2026 at 4:20 PM",
    blocksSalesOutreach: false,
    resolutionSummary: "Wrong units picked up by courier. Correct 72-inch assemblies delivered to site foreman at 4:00 PM yesterday.",
    salesFollowUpCompleted: true,
    salesFollowUpNote: "Called Marcus at 5 PM yesterday. Confirmed the 72-inch spreaders fit the trench box perfectly."
  }
];
