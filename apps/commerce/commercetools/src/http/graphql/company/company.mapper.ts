import type { Company } from "@csa/commerce-contract";
import type { CtCompany } from "./company.types.js";

export function mapCompany(company: CtCompany): Company {
  return {
    addresses: company.addresses ?? [],
    approvalRuleMode: company.approvalRuleMode,
    associateMode: company.associateMode,
    associates: (company.associates ?? []).map((associate) => ({
      customerId: associate.customer?.id,
      email: associate.customer?.email,
      firstName: associate.customer?.firstName,
      id: associate.customer?.id,
      lastName: associate.customer?.lastName,
      roles: (associate.associateRoleAssignments ?? [])
        .map((assignment) => assignment.associateRole?.name ?? assignment.associateRole?.key)
        .filter((role): role is string => Boolean(role))
    })),
    contactEmail: company.contactEmail ?? company.addresses?.find((address) => address.email)?.email,
    createdAt: company.createdAt,
    id: company.id,
    key: company.key,
    lastModifiedAt: company.lastModifiedAt,
    name: company.name,
    parentUnit: company.parentUnit,
    status: company.status,
    storeMode: company.storeMode,
    unitType: company.unitType
  };
}
