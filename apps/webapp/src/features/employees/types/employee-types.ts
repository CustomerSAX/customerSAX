/**
 * Employees Module Types
 *
 * Strongly-typed domain interfaces for CommerceTools B2B Employees / Associates.
 */

export interface EmployeeAddress {
  id: string;
  streetName: string;
  streetNumber?: string;
  city: string;
  postalCode: string;
  state?: string;
  country: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface EmployeeCompanyMembership {
  companyId: string;
  companyName: string;
  companyKey: string;
  roles: string[];
}

export interface Employee {
  id: string;
  customerNumber: string;
  externalId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  customerGroup?: string;
  status: "Active" | "Inactive";
  createdAt: string;
  lastModifiedAt: string;
  memberships: EmployeeCompanyMembership[];
  addresses: EmployeeAddress[];
}

export interface EmployeeFilter {
  searchField: "all" | "firstName" | "lastName" | "email" | "customerNumber" | "externalId";
  searchText: string;
  companyIdFilter?: string;
  roleFilter?: string;
}

export interface EmployeeSort {
  key: "firstName" | "lastName" | "email" | "customerNumber" | "createdAt";
  order: "asc" | "desc";
}
