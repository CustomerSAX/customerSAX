import type { CtCompany } from "./company.types.js";

export const sampleCompanies: CtCompany[] = [
  {
    addresses: [
      {
        city: "Bengaluru",
        company: "Doomsday",
        country: "IN",
        email: "shivam.soni@royalcyber.com",
        id: "addr-doomsday-primary",
        postalCode: "560001",
        streetName: "MG Road"
      }
    ],
    approvalRuleMode: "Explicit",
    associateMode: "Explicit",
    associates: [
      {
        associateRoleAssignments: [{ associateRole: { key: "admin", name: "Admin" } }],
        customer: {
          email: "shivam.soni@royalcyber.com",
          firstName: "Shivam",
          id: "customer-doomsday-admin",
          lastName: "Soni"
        }
      }
    ],
    contactEmail: "shivam.soni@royalcyber.com",
    createdAt: "2026-07-21T21:29:44.000Z",
    id: "business-unit-doomsday",
    key: "doomsday",
    lastModifiedAt: "2026-08-05T19:42:03.000Z",
    name: "Doomsday",
    status: "Active",
    storeMode: "Explicit",
    unitType: "Company"
  },
  {
    addresses: [],
    approvalRuleMode: "Explicit",
    associateMode: "Explicit",
    associates: [],
    createdAt: "2026-07-10T20:49:00.000Z",
    id: "business-unit-pooja",
    key: "pooja",
    lastModifiedAt: "2026-07-10T20:49:00.000Z",
    name: "Pooja Company",
    status: "Active",
    storeMode: "Explicit",
    unitType: "Company"
  },
  {
    addresses: [],
    approvalRuleMode: "Explicit",
    associateMode: "Explicit",
    associates: [],
    createdAt: "2026-06-01T15:22:00.000Z",
    id: "business-unit-xyz",
    key: "xyz",
    lastModifiedAt: "2026-07-07T21:37:00.000Z",
    name: "XYZ",
    status: "Active",
    storeMode: "Explicit",
    unitType: "Company"
  }
];
