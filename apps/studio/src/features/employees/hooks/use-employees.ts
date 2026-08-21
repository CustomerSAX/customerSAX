"use client";

import { gql, useMutation } from "@apollo/client";
import { useState, useCallback, useMemo } from "react";
import type { Employee, EmployeeAddress, EmployeeCompanyMembership, EmployeeFilter, EmployeeSort } from "../types/employee-types";
import { useCompanies } from "@/features/companies/hooks/use-companies";
import { COMPANIES_QUERY } from "@/features/companies/api/queries";

const CREATE_EMPLOYEE_MUTATION = gql`
  mutation CreateEmployee($draft: Json!, $companyId: ID!, $role: String!) {
    createEmployee(draft: $draft, companyId: $companyId, role: $role) {
      id customerNumber externalId email firstName lastName createdAt lastModifiedAt
    }
  }
`;

type CreateEmployeeData = {
  createEmployee: {
    id: string;
    customerNumber?: string | null;
    externalId?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    createdAt?: string | null;
    lastModifiedAt?: string | null;
  } | null;
};

export type NewEmployee = Omit<Employee, "id" | "customerNumber" | "externalId" | "createdAt" | "lastModifiedAt"> & {
  password: string;
};

export function useEmployees() {
  const { allCompanies, loading } = useCompanies();
  const [localEmployees, setLocalEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<EmployeeFilter>({ searchField: "all", searchText: "" });
  const [sort, setSort] = useState<EmployeeSort>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [createEmployeeMutation] = useMutation<CreateEmployeeData>(CREATE_EMPLOYEE_MUTATION);

  const companyEmployees = useMemo(() => {
    const employeeMap = new Map<string, Employee>();

    allCompanies.forEach((company) => {
      company.associates.forEach((associate) => {
        const id = associate.customerId || associate.id || associate.email;
        if (!id) return;

        const [firstName = "", ...rest] = associate.name && associate.name !== "Company associate"
          ? associate.name.split(" ")
          : [associate.email || ""];
        const lastName = rest.join(" ");
        const membership: EmployeeCompanyMembership = {
          companyId: company.id,
          companyKey: company.key,
          companyName: company.name,
          roles: associate.roles,
        };
        const existing = employeeMap.get(id);

        if (existing) {
          existing.memberships.push(membership);
          return;
        }

        employeeMap.set(id, {
          id,
          customerNumber: id,
          externalId: id,
          firstName,
          lastName,
          email: associate.email,
          status: associate.status,
          createdAt: company.createdAt,
          lastModifiedAt: company.lastModifiedAt,
          memberships: [membership],
          addresses: [],
        });
      });
    });

    return Array.from(employeeMap.values());
  }, [allCompanies]);

  const employees = useMemo(() => [...localEmployees, ...companyEmployees], [companyEmployees, localEmployees]);

  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    if (filter.companyIdFilter) {
      result = result.filter((emp) =>
        emp.memberships.some((m) => m.companyId === filter.companyIdFilter || m.companyKey === filter.companyIdFilter)
      );
    }

    if (filter.roleFilter) {
      result = result.filter((emp) =>
        emp.memberships.some((m) => m.roles.includes(filter.roleFilter!))
      );
    }

    if (filter.searchText.trim()) {
      const q = filter.searchText.toLowerCase().trim();
      result = result.filter((emp) => {
        if (filter.searchField === "firstName") return emp.firstName.toLowerCase().includes(q);
        if (filter.searchField === "lastName") return emp.lastName.toLowerCase().includes(q);
        if (filter.searchField === "email") return emp.email.toLowerCase().includes(q);
        if (filter.searchField === "customerNumber") return emp.customerNumber.toLowerCase().includes(q);
        if (filter.searchField === "externalId") return emp.externalId.toLowerCase().includes(q);
        return (
          emp.firstName.toLowerCase().includes(q) ||
          emp.lastName.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.customerNumber.toLowerCase().includes(q) ||
          emp.externalId.toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => {
      const valA = a[sort.key] ?? "";
      const valB = b[sort.key] ?? "";
      if (valA < valB) return sort.order === "asc" ? -1 : 1;
      if (valA > valB) return sort.order === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [employees, filter, sort]);

  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredEmployees.slice(start, start + perPage);
  }, [filteredEmployees, page, perPage]);

  const getEmployeeById = useCallback(
    (id: string) => employees.find((e) => e.id === id || e.customerNumber === id || e.email === id),
    [employees]
  );

  const createEmployee = useCallback(
    async (newEmployee: NewEmployee) => {
      const membership = newEmployee.memberships[0];
      if (!membership) throw new Error("Select a company for the employee.");
      const { password, memberships, addresses: _addresses, status: _status, customerGroup: _customerGroup, ...profile } = newEmployee;
      const result = await createEmployeeMutation({
        variables: {
          companyId: membership.companyId,
          role: membership.roles[0] ?? "Buyer",
          draft: {
            email: profile.email.trim(),
            password,
            firstName: profile.firstName.trim(),
            lastName: profile.lastName.trim(),
            ...(profile.middleName?.trim() ? { middleName: profile.middleName.trim() } : {}),
            ...(profile.phone?.trim() ? { phone: profile.phone.trim() } : {}),
            ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
          },
        },
        refetchQueries: [{ query: COMPANIES_QUERY, variables: {
          limit: 100,
          offset: 0,
          searchField: undefined,
          searchText: undefined,
          sortKey: "createdAt",
          sortOrder: "desc",
        } }],
        awaitRefetchQueries: true,
      });
      const created = result.data?.createEmployee;
      if (!created) throw new Error("The commerce service did not return the created employee.");

      return {
        ...newEmployee,
        id: created.id,
        customerNumber: created.customerNumber ?? created.id,
        externalId: created.externalId ?? created.id,
        email: created.email ?? newEmployee.email,
        firstName: created.firstName ?? newEmployee.firstName,
        lastName: created.lastName ?? newEmployee.lastName,
        createdAt: created.createdAt ?? "",
        lastModifiedAt: created.lastModifiedAt ?? created.createdAt ?? "",
      } satisfies Employee;
    },
    [createEmployeeMutation]
  );

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setLocalEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id || emp.customerNumber === id || emp.email === id
          ? { ...emp, ...updates, lastModifiedAt: new Date().toISOString() }
          : emp
      )
    );
  }, []);

  const addEmployeeAddress = useCallback((employeeId: string, address: Omit<EmployeeAddress, "id">) => {
    const newAddr: EmployeeAddress = {
      ...address,
      id: `eaddr-${Date.now()}`,
    };
    setLocalEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId
          ? { ...emp, addresses: [...emp.addresses, newAddr], lastModifiedAt: new Date().toISOString() }
          : emp
      )
    );
  }, []);

  const addEmployeeMembership = useCallback((employeeId: string, membership: EmployeeCompanyMembership) => {
    setLocalEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId
          ? { ...emp, memberships: [...emp.memberships.filter(m => m.companyId !== membership.companyId), membership], lastModifiedAt: new Date().toISOString() }
          : emp
      )
    );
  }, []);

  return {
    employees: paginatedEmployees,
    allEmployees: employees,
    totalItems: filteredEmployees.length,
    loading,
    filter,
    sort,
    page,
    perPage,
    setFilter,
    setSort,
    setPage,
    setPerPage,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    addEmployeeAddress,
    addEmployeeMembership,
  };
}
