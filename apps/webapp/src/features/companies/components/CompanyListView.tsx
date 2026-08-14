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
import { useCompanies } from "../hooks/use-companies";

const SEARCH_OPTIONS = [
  { value: "all", label: "All fields" },
  { value: "name", label: "Company Name" },
  { value: "key", label: "Key" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Unit Types" },
  { value: "Company", label: "Company" },
  { value: "Division", label: "Division" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

export function CompanyListView() {
  const router = useRouter();
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
        title="Companies"
        subtitle="Browse company hierarchy, addresses, and associates in CommerceTools B2B."
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            B2B Operations
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
              Import / Export
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() => router.push("/b2b/company/create")}
            >
              Create company
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
              placeholder="Search companies..."
              size="md"
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              value={filter.unitTypeFilter ?? ""}
              options={TYPE_OPTIONS}
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
              options={STATUS_OPTIONS}
              onChange={(e) => {
                setFilter({ ...filter, statusFilter: e.target.value });
                setPage(1);
              }}
              size="md"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="primary" size="md" onClick={handleSearchSubmit}>
              Search
            </Button>
            {(filter.searchText || filter.statusFilter || filter.unitTypeFilter) && (
              <Button variant="ghost" size="md" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Companies Table */}
      <Panel title={`Companies (${totalItems})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                sortable
                sortDirection={sort.key === "name" ? sort.order : false}
                onSort={() => handleSort("name")}
              >
                Company Name
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "key" ? sort.order : false}
                onSort={() => handleSort("key")}
              >
                Key
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "status" ? sort.order : false}
                onSort={() => handleSort("status")}
              >
                Status
              </TableHead>
              <TableHead>Unit Type</TableHead>
              <TableHead>Parent Unit</TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "createdAt" ? sort.order : false}
                onSort={() => handleSort("createdAt")}
              >
                Created
              </TableHead>
              <TableHead
                sortable
                sortDirection={sort.key === "lastModifiedAt" ? sort.order : false}
                onSort={() => handleSort("lastModifiedAt")}
              >
                Modified
              </TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
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
                    title="No Companies Found"
                    description="No business units match your filters. Try resetting search criteria or creating a new company."
                    action={
                      <Button variant="secondary" onClick={handleReset}>
                        Reset Filters
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
                      {comp.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={comp.unitType === "Company" ? "primary" : "info"} size="sm">
                      {comp.unitType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-m-text-muted">{comp.parentName ?? "--"}</TableCell>
                  <TableCell className="text-m-text-muted">
                    {formatDate(comp.createdAt)}
                  </TableCell>
                  <TableCell className="text-m-text-muted">
                    {formatDate(comp.lastModifiedAt)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      leftIcon={<Icon name="chevron-right" size="xs" />}
                      onClick={() => router.push(`/b2b/company/${comp.id}`)}
                      aria-label="View Company"
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
          />
        )}
      </Panel>
    </div>
  );
}
