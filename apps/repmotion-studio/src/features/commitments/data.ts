import type { CommitmentItem } from "./types";

/**
 * White Cap-specific commitment scenarios.
 * Aligned with the Module 1 priority scenarios and Module 2 account roster.
 * Every commitment is a real promise a field sales rep would make at a White Cap account.
 */
export const initialCommitments: CommitmentItem[] = [
  // ── OVERDUE: Must call customer NOW ────────────────────────────────────────
  {
    id: "WC-COM-01",
    accountId: "lakeside",
    accountName: "Lakeside Steel Fabricators",
    industry: "Heavy Fabrication & Processing",
    title: "Send live GPS truck milestone for delayed custom steel flange shipment",
    details:
      "Order slipped due to a freeway closure weather delay near Gary terminal. Tom Bradley is paused on his production line waiting for the milestone update before restarting his crew.",
    category: "logistics_tracking",
    categoryLabel: "Freight Expedite",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Tom Bradley",
      role: "Plant Operations Director",
      phone: "+1 (414) 555-0198",
      email: "tbradley@lakesidesteel.com",
      avatarInitials: "TB"
    },
    dueDate: "Overdue · 11:00 AM CST",
    dueTimestamp: "2026-10-23T11:00:00",
    urgency: "overdue",
    status: "Overdue",
    dependency: "Carrier EDI ping at Gary terminal — truck is in transit",
    linkedRecord: { type: "order", reference: "O-10319" },
    createdAt: "Yesterday at 2:30 PM",
    quickAction: {
      label: "Send Live Tracking Link",
      icon: "truck",
      confirmToast:
        "✓ Live GPS tracking link (O-10319) texted to Tom Bradley. ETA updated: 1:45 PM CST."
    }
  },

  // ── DUE TODAY: Morning urgency ─────────────────────────────────────────────
  {
    id: "WC-COM-02",
    accountId: "oakridge",
    accountName: "Oak Ridge Concrete",
    industry: "Heavy Commercial & Industrial Concrete",
    title: "Confirm tie-wire pallet hot-shot courier arrival before 11:30 AM pour",
    details:
      "Dave Henderson needs written ETA confirmation to clear his inspector and proceed with the Northway Commercial Center slab pour. Hot-shot van dispatched from Branch #12 at 10:15 AM.",
    category: "logistics_tracking",
    categoryLabel: "Hot-Shot Courier",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Dave Henderson",
      role: "General Jobsite Superintendent",
      phone: "+1 (312) 555-0194",
      email: "dave.henderson@oakridgeconcrete.com",
      avatarInitials: "DH"
    },
    dueDate: "Today · 10:45 AM CST",
    dueTimestamp: "2026-10-23T10:45:00",
    urgency: "today",
    status: "In Progress",
    dependency: "Branch #12 hot-shot van ETA confirmation from dispatcher",
    linkedRecord: { type: "order", reference: "SH-01" },
    createdAt: "Today at 8:12 AM",
    quickAction: {
      label: "Confirm Van Arrival ✓",
      icon: "truck",
      confirmToast:
        "✓ Arrival confirmed. Dave Henderson notified: Hot-shot van at Northway Commercial gate at 10:42 AM. Pour cleared."
    }
  },
  {
    id: "WC-COM-03",
    accountId: "summit",
    accountName: "Summit Commercial Builders",
    industry: "Commercial & High-Rise Construction",
    title: "Verify Chicago DC has 250 units tie-rod dowels in stock before PO issuance",
    details:
      "Jordan Lee is ready to issue formal PO for Phase 2 concrete pour on Monday. Needs written stock confirmation from Chicago warehouse today. No confirmation = no PO.",
    category: "stock_reservation",
    categoryLabel: "Inventory Reservation",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Jordan Lee",
      role: "Purchasing Director",
      phone: "+1 (312) 555-0194",
      email: "jordan.lee@summitbuilders.com",
      avatarInitials: "JL"
    },
    dueDate: "Today · 4:30 PM CST",
    dueTimestamp: "2026-10-23T16:30:00",
    urgency: "today",
    status: "Open",
    dependency: "Chicago DC Branch physical count confirmation (contact: DC Mgr. R. Patel)",
    linkedRecord: { type: "order", reference: "O-10489" },
    createdAt: "Today at 8:00 AM",
    quickAction: {
      label: "Send Stock Confirmation",
      icon: "boxes",
      confirmToast:
        "✓ Chicago DC stock confirmation sent to Jordan Lee. 250 tie-rod dowels reserved under PO hold — reference WC-RES-10489."
    }
  },
  {
    id: "WC-COM-04",
    accountId: "metro",
    accountName: "Metro Foundations",
    industry: "Civil Utilities & Underground Infrastructure",
    title: "Send ASTM C881 engineering spec cert packet — pour hold is active",
    details:
      "Metro Foundations cannot proceed with the Michigan Ave slab pour until the approved ASTM C881 certification packet is on file with their inspector. Marcus Vance is standing by.",
    category: "submittal_spec",
    categoryLabel: "Engineering Submittal",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Marcus Vance",
      role: "Senior Estimator & Procurement",
      phone: "+1 (312) 555-0142",
      email: "mvance@metrofoundations.com",
      avatarInitials: "MV"
    },
    dueDate: "Today · 2:00 PM CST",
    dueTimestamp: "2026-10-23T14:00:00",
    urgency: "today",
    status: "In Progress",
    dependency: "Applications Engineering team to stamp & email the ASTM C881 packet",
    linkedRecord: { type: "service_case", reference: "CASE-4408" },
    createdAt: "Yesterday at 4:15 PM",
    quickAction: {
      label: "Email Cert Packet Now",
      icon: "file-text",
      confirmToast:
        "✓ ASTM C881 18-page certification packet emailed to Marcus Vance & CC'd to the Metro Foundations site inspector. Pour hold can be cleared."
    }
  },

  // ── THIS WEEK ─────────────────────────────────────────────────────────────
  {
    id: "WC-COM-05",
    accountId: "apex",
    accountName: "Apex Framing Contractors",
    industry: "Residential & Light Commercial Framing",
    title: "Send 1-click e-sign acceptance link for $42.8K Quote Q-19501 (expires in 3 hrs)",
    details:
      "Apex Framing's Q-19501 (framing anchors + structural screws) expires today at 5 PM. Ryan Torres confirmed verbally he is ready to sign — rep just needs to transmit the digital link.",
    category: "pricing_quote",
    categoryLabel: "Quote Acceptance",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Ryan Torres",
      role: "Project Manager",
      phone: "+1 (630) 555-0182",
      email: "rtorres@apexframing.com",
      avatarInitials: "RT"
    },
    dueDate: "Today · 5:00 PM CST",
    dueTimestamp: "2026-10-23T17:00:00",
    urgency: "today",
    status: "Open",
    linkedRecord: { type: "quote", reference: "Q-19501" },
    createdAt: "Oct 21, 2026",
    quickAction: {
      label: "Transmit Accept Link ✉",
      icon: "badge-dollar-sign",
      confirmToast:
        "✓ 1-click e-sign link for Q-19501 ($42,800) sent to Ryan Torres. DocuSign notification delivered to rtorres@apexframing.com."
    }
  },
  {
    id: "WC-COM-06",
    accountId: "northstar",
    accountName: "NorthStar Logistics Hubs",
    industry: "Distribution Center Development",
    title: "Dispatch cold-pour sealant product sample kit to the I-90 DC jobsite trailer",
    details:
      "Hannah Ortiz requested a 3-tube sample of the WC Pro Cold-Pour Sealant + application nozzle kit for her site super to test before issuing a large-volume PO for the Milwaukee DC expansion.",
    category: "sample_shipment",
    categoryLabel: "Field Sample",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Hannah Ortiz",
      role: "Development Project Manager",
      phone: "+1 (708) 555-0164",
      email: "hortiz@northstarldc.com",
      avatarInitials: "HO"
    },
    dueDate: "Oct 24 · 12:00 PM CST",
    dueTimestamp: "2026-10-24T12:00:00",
    urgency: "this_week",
    status: "Open",
    dependency: "Branch #12 sample room to package and ship via FedEx Priority Overnight",
    linkedRecord: { type: "quote", reference: "Q-19041" },
    createdAt: "Oct 22, 2026",
    quickAction: {
      label: "Request Sample Dispatch",
      icon: "package",
      confirmToast:
        "✓ Sample kit dispatch requested from Branch #12. FedEx Priority Overnight shipping booked — tracking will be texted to Hannah Ortiz."
    }
  },
  {
    id: "WC-COM-07",
    accountId: "cedar",
    accountName: "Cedar Valley Components",
    industry: "Precision Machining & Aerospace Parts",
    title: "Issue $1,250 credit memo for surface-defect bracket lot (RMA-9182)",
    details:
      "Elena Rostova is holding their next fastener PO until she sees the credit reflected on their monthly statement. Accounting has approved RMA-9182 — just needs credit memo to be formally issued.",
    category: "billing_credit",
    categoryLabel: "Credit & Accounting",
    ownerName: "Sam Peterson",
    ownerRole: "Customer Care Specialist",
    contact: {
      name: "Elena Rostova",
      role: "Supply Chain Manager",
      phone: "+1 (616) 555-0177",
      email: "erostova@cedarcomponents.com",
      avatarInitials: "ER"
    },
    dueDate: "Oct 24 · 11:00 AM CST",
    dueTimestamp: "2026-10-24T11:00:00",
    urgency: "this_week",
    status: "In Progress",
    dependency: "Accounting team to cut credit memo CM-9182 in ERP",
    linkedRecord: { type: "service_case", reference: "CASE-4408" },
    createdAt: "Oct 21, 2026",
    quickAction: {
      label: "Confirm Credit Issued",
      icon: "credit-card",
      confirmToast:
        "✓ Credit memo CM-9182 ($1,250) issued and emailed to Elena Rostova. PO hold is cleared — Cedar Valley can release their next fastener order."
    }
  },
  {
    id: "WC-COM-08",
    accountId: "summit",
    accountName: "Summit Commercial Builders",
    industry: "Commercial & High-Rise Construction",
    title: "Provide tiered volume pricing matrix for 500+ unit anchor bolt packages",
    details:
      "Jordan Lee wants a 3-tier discount model (5%, 8%, 12%) for anchor bolt packages to present at their Friday procurement board meeting. Pricing Desk needs to sign off on the 12% top tier.",
    category: "pricing_quote",
    categoryLabel: "Volume Pricing",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Jordan Lee",
      role: "Purchasing Director",
      phone: "+1 (312) 555-0194",
      email: "jordan.lee@summitbuilders.com",
      avatarInitials: "JL"
    },
    dueDate: "Oct 25 · 3:00 PM CST",
    dueTimestamp: "2026-10-25T15:00:00",
    urgency: "this_week",
    status: "Open",
    dependency: "Pricing Desk approval on 12% top-tier bracket (contact: Pricing Mgr. Chris Wade)",
    linkedRecord: { type: "quote", reference: "Q-19602" },
    createdAt: "Oct 21, 2026",
    quickAction: {
      label: "Send Pricing Matrix",
      icon: "badge-dollar-sign",
      confirmToast:
        "✓ Volume pricing matrix (3-tier: 5%, 8%, 12%) emailed to Jordan Lee as a PDF. Ready for Friday's board meeting."
    }
  },

  // ── FULFILLED ─────────────────────────────────────────────────────────────
  {
    id: "WC-COM-09",
    accountId: "apex",
    accountName: "Apex Framing Contractors",
    industry: "Residential & Light Commercial Framing",
    title: "Deliver safety data sheets (SDS) and structural compliance cert for moisture barrier adhesives",
    details:
      "Provided certified lab testing documentation for ASTM D4541 pull-off adhesion strength. Site superintendent needed it before applying product on the school gymnasium project.",
    category: "submittal_spec",
    categoryLabel: "Compliance Certificate",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Ryan Torres",
      role: "Project Manager",
      phone: "+1 (630) 555-0182",
      email: "rtorres@apexframing.com",
      avatarInitials: "RT"
    },
    dueDate: "Fulfilled Today · 9:15 AM",
    dueTimestamp: "2026-10-23T09:15:00",
    urgency: "completed",
    status: "Fulfilled",
    fulfilledAt: "Today at 9:15 AM CST",
    fulfillmentNote:
      "Emailed complete 18-page ASTM D4541 compliance dossier to Ryan Torres and jobsite superintendent. Application cleared.",
    createdAt: "Oct 21, 2026"
  },
  {
    id: "WC-COM-10",
    accountId: "oakridge",
    accountName: "Oak Ridge Concrete",
    industry: "Heavy Commercial & Industrial Concrete",
    title: "Dispatch overnight sample of cold-weather curing blankets to Northway jobsite",
    details:
      "Overnighted 2 curing blanket samples + heater spec sheets for the next phase retaining wall work planned for next week's cold snap.",
    category: "sample_shipment",
    categoryLabel: "Field Sample",
    ownerName: "Alex Miller",
    ownerRole: "Outside Account Manager",
    contact: {
      name: "Dave Henderson",
      role: "General Jobsite Superintendent",
      phone: "+1 (312) 555-0194",
      email: "dave.henderson@oakridgeconcrete.com",
      avatarInitials: "DH"
    },
    dueDate: "Fulfilled Yesterday · 4:40 PM",
    dueTimestamp: "2026-10-22T16:40:00",
    urgency: "completed",
    status: "Fulfilled",
    fulfilledAt: "Yesterday at 4:40 PM CST",
    fulfillmentNote:
      "FedEx Priority Overnight #7849-2049-1120 delivered and signed at Northway Commercial Center jobsite trailer. Dave confirmed receipt.",
    createdAt: "Oct 21, 2026"
  }
];
