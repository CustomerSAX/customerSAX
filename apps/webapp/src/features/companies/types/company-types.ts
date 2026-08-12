/**
 * Companies Module Types
 *
 * Strongly-typed domain interfaces for CommerceTools B2B Companies / Business Units.
 */

export type CompanyUnitType = "Company" | "Division";
export type CompanyStatus = "Active" | "Inactive";

export interface CompanyAddress {
  id: string;
  companyName?: string;
  streetName: string;
  streetNumber?: string;
  apartment?: string;
  building?: string;
  city: string;
  postalCode: string;
  state?: string;
  region?: string;
  country: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface CompanyAssociate {
  id: string;
  customerId: string;
  name: string;
  email: string;
  roles: string[];
  status: "Active" | "Inactive";
}

export interface Company {
  id: string;
  name: string;
  key: string;
  status: CompanyStatus;
  unitType: CompanyUnitType;
  parentId?: string;
  parentName?: string;
  storeKey?: string;
  createdAt: string;
  lastModifiedAt: string;
  addresses: CompanyAddress[];
  associates: CompanyAssociate[];
  creditLimit?: number;
  creditUsed?: number;
}

export interface CompanyFilter {
  searchField: "all" | "name" | "key";
  searchText: string;
  statusFilter?: string;
  unitTypeFilter?: string;
}

export interface CompanySort {
  key: "name" | "key" | "status" | "createdAt" | "lastModifiedAt";
  order: "asc" | "desc";
}
