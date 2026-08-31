"use client";

import { useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Badge,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tabs,
} from "@csa/ui";
import { formatDateTime } from "@/lib/format-date";
import { useCartStore } from "@/features/cart/hooks/use-carts";
import { useCompanies } from "@/features/companies/hooks/use-companies";
import { useEmployees } from "@/features/employees/hooks/use-employees";
import { useQuotes } from "@/features/quotes/hooks/use-quotes";
import { downloadCsv, useImportExport } from "../hooks/use-import-export";
import type { ImportCsvRow } from "../hooks/use-import-export";
import type { B2BResourceType } from "../types/import-export-types";

const RESOURCE_OPTIONS = [
  { value: "company", label: "Company / Business Units" },
  { value: "employee", label: "Employees" },
  { value: "cart", label: "Carts" },
  { value: "quote", label: "Quotes" },
];

type ImportExportTab = "import" | "export";

const COUNTRY_OPTIONS = [
  { value: "", label: "All Countries" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "CA", label: "Canada" },
];

const CURRENCY_OPTIONS = [
  { value: "", label: "All Currencies" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
];

const EXPORT_COLUMNS: Record<B2BResourceType, string[]> = {
  company: [
    "id",
    "key",
    "name",
    "status",
    "unitType",
    "parentName",
    "countries",
    "associateCount",
    "createdAt",
    "lastModifiedAt",
  ],
  employee: [
    "id",
    "customerNumber",
    "externalId",
    "email",
    "firstName",
    "lastName",
    "status",
    "companies",
    "roles",
    "createdAt",
    "lastModifiedAt",
  ],
  cart: [
    "id",
    "cartNumber",
    "customerEmail",
    "customerName",
    "country",
    "currencyCode",
    "cartState",
    "lineItemCount",
    "grandTotal",
    "createdAt",
    "lastModifiedAt",
  ],
  quote: [
    "id",
    "quoteNumber",
    "companyKey",
    "companyName",
    "customerEmail",
    "currencyCode",
    "itemCount",
    "status",
    "negotiatedTotal",
    "validUntil",
    "createdAt",
    "lastModifiedAt",
  ],
};

export function ImportExportView() {
  const searchParams = useSearchParams();
  const initialResource = (searchParams.get("resource") as B2BResourceType) || "company";

  const {
    selectedResource,
    setSelectedResource,
    importHistory,
    exportHistory,
    isProcessing,
    importResults,
    processImport,
    triggerExport,
  } = useImportExport(initialResource);

  const [activeTab, setActiveTab] = useState<ImportExportTab>("import");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { allCompanies, createCompany, loading: companiesLoading } = useCompanies();
  const { allEmployees, createEmployee, loading: employeesLoading } = useEmployees();
  const { carts, reloadCarts, loading: cartsLoading } = useCartStore();
  const { allQuotes, loading: quotesLoading } = useQuotes();

  // Export filters
  const [exportCountry, setExportCountry] = useState("");
  const [exportCurrency, setExportCurrency] = useState("");

  const exportRows = useMemo(() => {
    if (selectedResource === "company") {
      return allCompanies
        .filter((company) =>
          exportCountry ? company.addresses.some((address) => address.country === exportCountry) : true
        )
        .map((company) => ({
          id: company.id,
          key: company.key,
          name: company.name,
          status: company.status,
          unitType: company.unitType,
          parentName: company.parentName,
          countries: company.addresses.map((address) => address.country).filter(Boolean).join("; "),
          associateCount: company.associates.length,
          createdAt: company.createdAt,
          lastModifiedAt: company.lastModifiedAt,
        }));
    }

    if (selectedResource === "employee") {
      return allEmployees
        .filter((employee) =>
          exportCountry ? employee.addresses.some((address) => address.country === exportCountry) : true
        )
        .map((employee) => ({
          id: employee.id,
          customerNumber: employee.customerNumber,
          externalId: employee.externalId,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          status: employee.status,
          companies: employee.memberships.map((membership) => membership.companyName).join("; "),
          roles: employee.memberships.flatMap((membership) => membership.roles).join("; "),
          createdAt: employee.createdAt,
          lastModifiedAt: employee.lastModifiedAt,
        }));
    }

    if (selectedResource === "cart") {
      return carts
        .filter((cart) => {
          const country = cart.country || cart.shippingAddress?.country || cart.billingAddress?.country;
          const countryMatches = exportCountry ? country === exportCountry : true;
          const currencyMatches = exportCurrency ? cart.currencyCode === exportCurrency : true;
          return countryMatches && currencyMatches;
        })
        .map((cart) => ({
          id: cart.id,
          cartNumber: cart.cartNumber,
          customerEmail: cart.customerEmail,
          customerName: cart.customerName,
          country: cart.country || cart.shippingAddress?.country || cart.billingAddress?.country,
          currencyCode: cart.currencyCode,
          cartState: cart.cartState,
          lineItemCount: cart.lineItems.length,
          grandTotal: cart.grandTotal,
          createdAt: cart.createdAt,
          lastModifiedAt: cart.lastModifiedAt,
        }));
    }

    return allQuotes
      .filter((quote) => (exportCurrency ? quote.currencyCode === exportCurrency : true))
      .map((quote) => ({
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        companyKey: quote.companyKey,
        companyName: quote.companyName,
        customerEmail: quote.customerEmail,
        currencyCode: quote.currencyCode,
        itemCount: quote.itemCount,
        status: quote.status,
        negotiatedTotal: quote.negotiatedTotal,
        validUntil: quote.validUntil,
        createdAt: quote.createdAt,
        lastModifiedAt: quote.lastModifiedAt,
      }));
  }, [allCompanies, allEmployees, allQuotes, carts, exportCountry, exportCurrency, selectedResource]);

  const isExportLoading =
    (selectedResource === "company" && companiesLoading) ||
    (selectedResource === "employee" && employeesLoading) ||
    (selectedResource === "cart" && cartsLoading) ||
    (selectedResource === "quote" && quotesLoading);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleStartImport = () => {
    if (!selectedFile) return;
    void processImport(selectedFile, importCsvRow);
  };

  const requireValue = (row: ImportCsvRow, field: string) => {
    const value = row[field]?.trim();
    if (!value) throw new Error(`Missing required field "${field}".`);
    return value;
  };

  const importCsvRow = async (row: ImportCsvRow) => {
    if (selectedResource === "company") {
      const parentKey = row.parentKey?.trim();
      const parent = parentKey
        ? allCompanies.find((company) => company.key === parentKey || company.id === parentKey)
        : undefined;
      if (parentKey && !parent) throw new Error(`Parent company "${parentKey}" was not found.`);

      await createCompany({
        name: requireValue(row, "name"),
        key: requireValue(row, "key"),
        unitType: row.unitType === "Division" ? "Division" : "Company",
        parentId: parent?.id,
        parentName: parent?.name,
        status: row.status === "Inactive" ? "Inactive" : "Active",
        addresses: row.country
          ? [{
              id: `import-address-${Date.now()}`,
              companyName: row.name,
              streetName: row.streetName || "",
              streetNumber: row.streetNumber || undefined,
              city: row.city || "",
              state: row.state || undefined,
              postalCode: row.postalCode || "",
              country: row.country,
            }]
          : [],
        associates: [],
      });
      return;
    }

    if (selectedResource === "employee") {
      const companyKey = requireValue(row, "companyKey");
      const company = allCompanies.find((item) => item.key === companyKey || item.id === companyKey);
      if (!company) throw new Error(`Company "${companyKey}" was not found.`);

      await createEmployee({
        email: requireValue(row, "email"),
        firstName: requireValue(row, "firstName"),
        lastName: requireValue(row, "lastName"),
        password: row.password?.trim() || `Temp-${crypto.randomUUID()}-Aa1!`,
        status: row.status === "Inactive" ? "Inactive" : "Active",
        memberships: [{
          companyId: company.id,
          companyName: company.name,
          companyKey: company.key,
          roles: (row.roles || "Buyer").split(";").map((role) => role.trim()).filter(Boolean),
        }],
        addresses: [],
      });
      return;
    }

    if (selectedResource === "cart") {
      const response = await fetch("/api/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: row.currency || row.currencyCode || "USD",
          businessUnitKey: row.companyKey || undefined,
          customerId: row.customerId || undefined,
          customerEmail: row.customerEmail || undefined,
        }),
      });
      const cart = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !cart.id) throw new Error(cart.error || "Cart creation failed.");

      const sku = row.lineItemSku?.trim();
      const quantity = Number(row.quantity || 1);
      if (sku) {
        const updateResponse = await fetch(`/api/carts/${encodeURIComponent(cart.id)}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions: [{ addLineItem: { sku, quantity: Number.isFinite(quantity) ? quantity : 1 } }] }),
        });
        const updatePayload = (await updateResponse.json().catch(() => ({}))) as { error?: string };
        if (!updateResponse.ok) throw new Error(updatePayload.error || "Cart line item import failed.");
      }
      await reloadCarts();
      return;
    }

    const cartId = row.cartId?.trim() || row.cartKey?.trim();
    if (!cartId) throw new Error('Missing required field "cartId".');
    const response = await fetch("/api/quotes/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId, comment: row.comment || undefined }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Quote request creation failed.");
  };

  const downloadSampleTemplate = () => {
    const sampleHeaders: Record<B2BResourceType, string> = {
      company: "name,key,unitType,parentKey,status,streetName,streetNumber,city,state,postalCode,country",
      employee: "email,firstName,lastName,password,companyKey,roles,status",
      cart: "currency,customerId,customerEmail,companyKey,lineItemSku,quantity",
      quote: "cartId,comment",
    };

    const blob = new Blob([sampleHeaders[selectedResource]], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `b2b-${selectedResource}-sample-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="B2B Import / Export"
        subtitle="Batch import or export employees, business units, carts, or quotes via CSV."
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            B2B Operations
          </span>
        }
      />

      {/* Target Resource Selector */}
      <Panel title="Data Management Configuration">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5">
          <label className="text-xs font-semibold text-m-text shrink-0">
            Target B2B Resource:
          </label>
          <div className="w-full sm:w-72">
            <Select
              value={selectedResource}
              options={RESOURCE_OPTIONS}
              onChange={(e) => {
                setSelectedResource(e.target.value as B2BResourceType);
                setSelectedFile(null);
              }}
              size="md"
            />
          </div>
        </div>
      </Panel>

      {/* Import / Export Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => {
        if (value === "import" || value === "export") setActiveTab(value);
      }}>
        <Tabs.List>
          <Tabs.Trigger value="import">Batch Import (CSV)</Tabs.Trigger>
          <Tabs.Trigger value="export">Data Export (CSV)</Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: Import */}
        <Tabs.Content value="import">
          <div className="flex flex-col gap-6 mt-4">
            <Panel
              title={`Import ${RESOURCE_OPTIONS.find((r) => r.value === selectedResource)?.label}`}
              headerActions={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Icon name="download" size="xs" />}
                  onClick={downloadSampleTemplate}
                >
                  Download Sample CSV Template
                </Button>
              }
            >
              <div className="p-6 flex flex-col gap-4">
                {/* Drag & Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-m-xl transition-colors cursor-pointer text-center ${
                    dragActive
                      ? "border-m-primary bg-m-primary-50/40"
                      : "border-m-border hover:border-m-primary-300 bg-m-surface-1"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="h-12 w-12 rounded-full bg-m-primary-50 flex items-center justify-center text-m-primary mb-3">
                    <Icon name="upload-cloud" size="md" />
                  </div>
                  <p className="text-sm font-semibold text-m-text">
                    {selectedFile ? selectedFile.name : "Click or drag & drop CSV file to upload"}
                  </p>
                  <p className="text-xs text-m-text-muted mt-1">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB — Ready for processing`
                      : "Supports .csv files up to 10MB"}
                  </p>
                </div>

                {/* Import Action */}
                {selectedFile && (
                  <div className="flex items-center justify-between p-4 border border-m-border rounded-m-lg bg-m-surface">
                    <div className="flex items-center gap-3">
                      <Icon name="file-text" size="md" className="text-m-primary" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-m-text">{selectedFile.name}</span>
                        <span className="text-[11px] text-m-text-muted">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      disabled={isProcessing}
                      onClick={handleStartImport}
                      leftIcon={<Icon name="play" size="xs" />}
                    >
                      {isProcessing ? "Processing Import..." : "Process Import"}
                    </Button>
                  </div>
                )}

                {/* Validation / Result Feed */}
                {importResults && (
                  <div className="flex flex-col gap-3 mt-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-m-text">
                      Import Process Results
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Line #</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead>Message / Log</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResults.map((res) => (
                          <TableRow key={res.line}>
                            <TableCell className="font-mono text-xs text-m-text-muted">
                              Line {res.line}
                            </TableCell>
                            <TableCell>
                              <Badge variant={res.success ? "success" : "error"} size="sm">
                                {res.success ? "Success" : "Error"}
                              </Badge>
                            </TableCell>
                            <TableCell className={res.success ? "text-m-text" : "text-m-danger font-medium"}>
                              {res.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </Panel>

            {/* Recent Import History */}
            <Panel title="Recent Import History">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Rows Processed</TableHead>
                    <TableHead>Success / Error</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-semibold text-m-text">{job.filename}</TableCell>
                      <TableCell>
                        <Badge variant="primary" size="sm">
                          {job.resource}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-m-text-muted">{job.fileSize}</TableCell>
                      <TableCell>{job.totalRows}</TableCell>
                      <TableCell>
                        <span className="text-m-success font-semibold">{job.successCount}</span>
                        {job.errorCount > 0 && (
                          <span className="text-m-danger font-semibold ml-1.5">
                            ({job.errorCount} errors)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-m-text-muted">
                        {formatDateTime(job.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.status === "Completed" ? "success" : "error"} size="sm">
                          {job.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>

        {/* Tab 2: Export */}
        <Tabs.Content value="export">
          <div className="flex flex-col gap-6 mt-4">
            <Panel title={`Export ${RESOURCE_OPTIONS.find((r) => r.value === selectedResource)?.label}`}>
              <div className="flex flex-col gap-5 p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-m-text mb-1 block">
                      Filter Country
                    </label>
                    <Select
                      value={exportCountry}
                      options={COUNTRY_OPTIONS}
                      onChange={(e) => setExportCountry(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-m-text mb-1 block">
                      Currency Filter
                    </label>
                    <Select
                      value={exportCurrency}
                      options={CURRENCY_OPTIONS}
                      onChange={(e) => setExportCurrency(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-m-border">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={isProcessing || isExportLoading}
                    onClick={() => triggerExport(exportRows, EXPORT_COLUMNS[selectedResource])}
                    leftIcon={<Icon name="download" size="xs" />}
                  >
                    {isProcessing || isExportLoading ? "Generating CSV..." : "Generate & Download Export"}
                  </Button>
                </div>
              </div>
            </Panel>

            {/* Recent Export History */}
            <Panel title="Recent Export History">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="w-12 text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportHistory.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-semibold text-m-text">{exp.filename}</TableCell>
                      <TableCell>
                        <Badge variant="primary" size="sm">
                          {exp.resource}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-m-text-muted">{exp.fileSize}</TableCell>
                      <TableCell>{exp.recordCount}</TableCell>
                      <TableCell className="text-m-text-muted">
                        {formatDateTime(exp.timestamp)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          leftIcon={<Icon name="download" size="xs" />}
                          aria-label="Download CSV"
                          onClick={() => downloadCsv(exp.filename, exp.csvContent)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
