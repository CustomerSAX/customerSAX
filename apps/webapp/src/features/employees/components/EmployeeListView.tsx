"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  SearchBar,
  Select,
  EmptyState,
  Skeleton,
} from "@csa/ui";
import { formatDate } from "@/lib/format-date";
import { useEmployees } from "../hooks/use-employees";
import { useCompanies } from "@/features/companies/hooks/use-companies";

const SEARCH_OPTIONS = [
  { value: "all", label: "All fields" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "customerNumber", label: "Customer Number" },
  { value: "externalId", label: "External Id" },
];

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "Admin", label: "Admin" },
  { value: "Buyer", label: "Buyer" },
  { value: "Approver", label: "Approver" },
];

export function EmployeeListView() {
  const router = useRouter();
  const {
    employees,
    totalItems,
    loading,
    filter,
    sort,
    page,
    perPage,
    setFilter,
    setSort,
    setPage,
    setPerPage,
  } = useEmployees();

  const { allCompanies } = useCompanies();

  const [searchField, setSearchField] = useState<any>("all");
  const [searchText, setSearchText] = useState("");

  const companyOptions = [
    { value: "", label: "All Companies" },
    ...allCompanies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleSearchSubmit = () => {
    setFilter({
      ...filter,
      searchField,
      searchText,
    });
    setPage(1);
  };

  const handleReset = () => {
    setSearchText("");
    setSearchField("all");
    setFilter({ searchField: "all", searchText: "", companyIdFilter: "", roleFilter: "" });
    setPage(1);
  };

  const handleSort = (key: typeof sort.key) => {
    setSort({
      key,
      order: sort.key === key && sort.order === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Employees"
        subtitle="Associates linked to a business unit with their B2B roles."
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            Companies
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="arrow-left-right" size="xs" />}
              onClick={() => router.push("/b2b/import-export?resource=employee")}
            >
              Import / Export
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() => router.push("/b2b/employees/create")}
            >
              Add employee
            </Button>
          </div>
        }
      />

      {/* Toolbar Panel */}
      <Panel>
        <div className="flex flex-col sm:flex-row items-center gap-3 p-4">
          <div className="w-full sm:w-44">
            <Select
              value={searchField}
              options={SEARCH_OPTIONS}
              onChange={(e) => setSearchField(e.target.value as any)}
              size="md"
            />
          </div>

          <div className="flex-1 min-w-0 w-full">
            <SearchBar
              value={searchText}
              onChange={(val) => setSearchText(val)}
              onSearch={handleSearchSubmit}
              onClear={() => setSearchText("")}
              placeholder="Search employees by name, email, or number..."
              size="md"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={filter.companyIdFilter ?? ""}
              options={companyOptions}
              onChange={(e) => {
                setFilter({ ...filter, companyIdFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="w-full sm:w-36">
            <Select
              value={filter.roleFilter ?? ""}
              options={ROLE_OPTIONS}
              onChange={(e) => {
                setFilter({ ...filter, roleFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="primary" size="md" onClick={handleSearchSubmit}>
              Search
            </Button>
            {(filter.searchText || filter.companyIdFilter || filter.roleFilter) && (
              <Button variant="ghost" size="md" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Employees Table */}
      <Panel title={`Employees (${totalItems})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                sortable
                sortDirection={sort.key === "customerNumber" ? sort.order : false}
                onSort={() => handleSort("customerNumber")}
              >
                Customer #
              </TableHead>
              <TableHead>External ID</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "firstName" ? sort.order : false}
                onSort={() => handleSort("firstName")}
              >
                First Name
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "lastName" ? sort.order : false}
                onSort={() => handleSort("lastName")}
              >
                Last Name
              </TableHead>
              <TableHead>Company</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "email" ? sort.order : false}
                onSort={() => handleSort("email")}
              >
                Email
              </TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "createdAt" ? sort.order : false}
                onSort={() => handleSort("createdAt")}
              >
                Created
              </TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton width="80%" height={16} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12">
                  <EmptyState
                    icon="user-check"
                    title="No Employees Found"
                    description="No associates match your selected filters. Try resetting search criteria or adding a new employee."
                    action={
                      <Button variant="secondary" onClick={handleReset}>
                        Reset Filters
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const primaryCompany = emp.memberships[0]?.companyName ?? "--";
                const roles = emp.memberships.flatMap((m) => m.roles).join(", ") || "Member";

                return (
                  <TableRow
                    key={emp.id}
                    clickable
                    onClick={() => router.push(`/b2b/employees/${emp.id}`)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-m-primary">
                      {emp.customerNumber}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-m-text-muted">
                      {emp.externalId}
                    </TableCell>
                    <TableCell className="font-semibold text-m-text">{emp.firstName}</TableCell>
                    <TableCell className="font-semibold text-m-text">{emp.lastName}</TableCell>
                    <TableCell className="text-m-primary font-medium">{primaryCompany}</TableCell>
                    <TableCell className="text-m-text-muted">{emp.email}</TableCell>
                    <TableCell className="text-m-text-muted">{emp.customerGroup ?? "--"}</TableCell>
                    <TableCell>
                      <Badge variant="primary" size="sm">
                        {roles}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-m-text-muted">
                      {formatDate(emp.createdAt)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        leftIcon={<Icon name="chevron-right" size="xs" />}
                        onClick={() => router.push(`/b2b/employees/${emp.id}`)}
                        aria-label="View Employee"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {totalItems > 0 && (
          <TablePagination
            page={page}
            totalPages={Math.ceil(totalItems / perPage)}
            totalItems={totalItems}
            pageSize={perPage}
            onPageChange={setPage}
            onPageSizeChange={setPerPage}
          />
        )}
      </Panel>
    </div>
  );
}
