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
import { useCompanies } from "../hooks/use-companies";

export function CompanyListView() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Companies");
  const common = useTranslations("Common");
  const paginationLabels = useTablePaginationLabels();
  const {
    companies,
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
  } = useCompanies();

  const [searchField, setSearchField] = useState<"all" | "name" | "key">("all");
  const [searchText, setSearchText] = useState("");
  const searchOptions = [
    { value: "all", label: common("allFields") },
    { value: "name", label: t("companyName") },
    { value: "key", label: t("key") },
  ];
  const typeOptions = [
    { value: "", label: t("allUnitTypes") },
    { value: "Company", label: t("company") },
    { value: "Division", label: t("division") },
  ];
  const statusOptions = [
    { value: "", label: common("allStatuses") },
    { value: "Active", label: common("active") },
    { value: "Inactive", label: common("inactive") },
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
    setFilter({ searchField: "all", searchText: "", statusFilter: "", unitTypeFilter: "" });
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
            {t("eyebrow")}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="arrow-left-right" size="xs" />}
              onClick={() => router.push("/b2b/import-export?resource=company")}
            >
              {t("importExport")}
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() => router.push("/b2b/company/create")}
            >
              {t("create")}
            </Button>
          </div>
        }
      />

      {/* Filter / Search Panel */}
      <Panel>
        <div className="flex flex-col sm:flex-row items-center gap-3 p-4">
          <div className="w-full sm:w-44">
            <Select
              value={searchField}
              options={searchOptions}
              onChange={(e) => setSearchField(e.target.value as "all" | "name" | "key")}
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

          <div className="w-full sm:w-44">
            <Select
              value={filter.unitTypeFilter ?? ""}
              options={typeOptions}
              onChange={(e) => {
                setFilter({ ...filter, unitTypeFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="w-full sm:w-40">
            <Select
              value={filter.statusFilter ?? ""}
              options={statusOptions}
              onChange={(e) => {
                setFilter({ ...filter, statusFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="primary" size="md" onClick={handleSearchSubmit}>
              {common("search")}
            </Button>
            {(filter.searchText || filter.statusFilter || filter.unitTypeFilter) && (
              <Button variant="ghost" size="md" onClick={handleReset}>
                {common("reset")}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Companies Table */}
      <Panel title={t("countTitle", { count: totalItems })}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                sortable
                sortDirection={sort.key === "name" ? sort.order : false}
                onSort={() => handleSort("name")}
              >
                {t("companyName")}
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "key" ? sort.order : false}
                onSort={() => handleSort("key")}
              >
                {t("key")}
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "status" ? sort.order : false}
                onSort={() => handleSort("status")}
              >
                {common("status")}
              </TableHead>
              <TableHead>{t("unitType")}</TableHead>
              <TableHead>{t("parentUnit")}</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "createdAt" ? sort.order : false}
                onSort={() => handleSort("createdAt")}
              >
                {common("created")}
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "lastModifiedAt" ? sort.order : false}
                onSort={() => handleSort("lastModifiedAt")}
              >
                {common("modified")}
              </TableHead>
              <TableHead className="w-12 text-right">{common("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton width="80%" height={16} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <EmptyState
                    icon="building-2"
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
              companies.map((comp) => (
                <TableRow
                  key={comp.id}
                  clickable
                  onClick={() => router.push(`/b2b/company/${comp.id}`)}
                >
                  <TableCell className="font-semibold text-m-primary">{comp.name}</TableCell>
                  <TableCell className="font-mono text-xs text-m-text-muted">{comp.key}</TableCell>
                  <TableCell>
                    <Badge variant={comp.status === "Active" ? "success" : "neutral"} size="sm">
                      {comp.status === "Active" ? common("active") : common("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={comp.unitType === "Company" ? "primary" : "info"} size="sm">
                      {comp.unitType === "Company" ? t("company") : t("division")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-m-text-muted">{comp.parentName ?? "--"}</TableCell>
                  <TableCell className="text-m-text-muted">
                    {formatDate(comp.createdAt, locale)}
                  </TableCell>
                  <TableCell className="text-m-text-muted">
                    {formatDate(comp.lastModifiedAt, locale)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      leftIcon={<Icon name="chevron-right" size="xs" />}
                      onClick={() => router.push(`/b2b/company/${comp.id}`)}
                      aria-label={common("view", { entity: t("company") })}
                    />
                  </TableCell>
                </TableRow>
              ))
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
