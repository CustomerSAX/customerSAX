"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { useTablePaginationLabels } from "@/lib/use-table-pagination-labels";
import { useEmployees } from "../hooks/use-employees";
import { useCompanies } from "@/features/companies/hooks/use-companies";

type EmployeeSearchField = "all" | "firstName" | "lastName" | "email" | "customerNumber" | "externalId";

export function EmployeeListView() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Employees");
  const common = useTranslations("Common");
  const paginationLabels = useTablePaginationLabels();
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

  const [searchField, setSearchField] = useState<EmployeeSearchField>("all");
  const [searchText, setSearchText] = useState("");

  const searchOptions = [
    { value: "all", label: common("allFields") },
    { value: "firstName", label: t("firstName") },
    { value: "lastName", label: t("lastName") },
    { value: "email", label: t("email") },
    { value: "customerNumber", label: t("customerNumber") },
    { value: "externalId", label: t("externalId") },
  ];
  const roleOptions = [
    { value: "", label: t("allRoles") },
    { value: "Admin", label: "Admin" },
    { value: "Buyer", label: "Buyer" },
    { value: "Approver", label: "Approver" },
  ];

  const companyOptions = [
    { value: "", label: t("allCompanies") },
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
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            {t("companies")}
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
              {t("importExport")}
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() => router.push("/b2b/employees/create")}
            >
              {t("add")}
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
              options={searchOptions}
              onChange={(e) => setSearchField(e.target.value as EmployeeSearchField)}
              size="md"
            />
          </div>

          <div className="flex-1 min-w-0 w-full">
            <SearchBar
              value={searchText}
              onChange={(val) => setSearchText(val)}
              onSearch={handleSearchSubmit}
              onClear={() => setSearchText("")}
              placeholder={t("searchPlaceholder")}
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
              options={roleOptions}
              onChange={(e) => {
                setFilter({ ...filter, roleFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="primary" size="md" onClick={handleSearchSubmit}>
              {common("search")}
            </Button>
            {(filter.searchText || filter.companyIdFilter || filter.roleFilter) && (
              <Button variant="ghost" size="md" onClick={handleReset}>
                {common("reset")}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Employees Table */}
      <Panel title={t("countTitle", { count: totalItems })}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                sortable
                sortDirection={sort.key === "customerNumber" ? sort.order : false}
                onSort={() => handleSort("customerNumber")}
              >
                {t("customerNumber")}
              </TableHead>
              <TableHead>{t("externalId")}</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "firstName" ? sort.order : false}
                onSort={() => handleSort("firstName")}
              >
                {t("firstName")}
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "lastName" ? sort.order : false}
                onSort={() => handleSort("lastName")}
              >
                {t("lastName")}
              </TableHead>
              <TableHead>{t("company")}</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "email" ? sort.order : false}
                onSort={() => handleSort("email")}
              >
                {t("email")}
              </TableHead>
              <TableHead>{t("group")}</TableHead>
              <TableHead>{t("roles")}</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "createdAt" ? sort.order : false}
                onSort={() => handleSort("createdAt")}
              >
                {common("created")}
              </TableHead>
              <TableHead className="w-12 text-right">{common("actions")}</TableHead>
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
                    title={t("emptyTitle")}
                    description={t("emptyDescription")}
                    action={
                      <Button variant="secondary" onClick={handleReset}>
                        {t("resetFilters")}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const primaryCompany = emp.memberships[0]?.companyName ?? "--";
                const roles = emp.memberships.flatMap((m) => m.roles).join(", ") || t("member");

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
                      {formatDate(emp.createdAt, locale)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        leftIcon={<Icon name="chevron-right" size="xs" />}
                        onClick={() => router.push(`/b2b/employees/${emp.id}`)}
                        aria-label={common("view", { entity: t("employee") })}
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
            labels={paginationLabels}
          />
        )}
      </Panel>
    </div>
  );
}
