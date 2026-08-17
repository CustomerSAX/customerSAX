import type { PagingArgs } from "../shared/paging.js";

export type CompanySearchArgs = PagingArgs & {
  searchField?: string;
  searchText?: string;
};

export type CtCompanyAddress = {
  id?: string;
  key?: string;
  streetName?: string;
  streetNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  company?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
};

export type CtCompanyAssociate = {
  associateRoleAssignments?: Array<{
    associateRole?: {
      key?: string;
      name?: string;
    };
  }>;
  customer?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

export type CtCompany = {
  id: string;
  key: string;
  name: string;
  status?: string;
  unitType?: string;
  associateMode?: string;
  approvalRuleMode?: string;
  storeMode?: string;
  contactEmail?: string;
  createdAt?: string;
  lastModifiedAt?: string;
  parentUnit?: {
    id?: string;
    key?: string;
    name?: string;
  };
  addresses?: CtCompanyAddress[];
  associates?: CtCompanyAssociate[];
};
