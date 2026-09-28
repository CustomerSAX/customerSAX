"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, Icon } from "@csa/ui";
import type { KnowledgeBaseGroupedData } from "@csa/mongodb";

interface KnowledgeBaseAdminProps {
  clientId: string;
}

export function KnowledgeBaseAdmin({ clientId }: KnowledgeBaseAdminProps) {
  const [data, setData] = useState<KnowledgeBaseGroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load current KB status
  const fetchKnowledgeBase = async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/organizations/${clientId}/knowledge-base`, {
        cache: "no-store"
      });
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
      }
    } catch (err) {
      console.error("Failed to fetch knowledge base:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchKnowledgeBase();
  }, [clientId]);

  // Handle template download
  const handleDownloadTemplate = () => {
    const downloadUrl = `/api/organizations/${clientId}/knowledge-base/template`;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "knowledge-base-template.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setSuccessMessage(null);
    setValidationErrors(null);
    setGeneralError(null);
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile || !clientId) return;

    setUploading(true);
    setSuccessMessage(null);
    setValidationErrors(null);
    setGeneralError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(
        `/api/organizations/${clientId}/knowledge-base/upload`,
        {
          method: "POST",
          body: formData
        }
      );

      const result = await res.json();

      if (!res.ok || !result.ok) {
        if (result.errors && Array.isArray(result.errors)) {
          setValidationErrors(result.errors);
        } else {
          setGeneralError(
            result.detail
              ? `${result.error} (${result.detail})`
              : (result.error || "Failed to upload knowledge base spreadsheet.")
          );
        }
      } else {
        setSuccessMessage("Knowledge Base uploaded successfully.");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        await fetchKnowledgeBase();
      }
    } catch (err: any) {
      setGeneralError(
        "An unexpected network error occurred while uploading. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const status = data?.status;
  const hasContent = (status?.faqCount ?? 0) > 0 || (status?.troubleshootCount ?? 0) > 0;

  const formattedLastUpdated = status?.lastUpdatedAt
    ? new Date(status.lastUpdatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "Never";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-m-text">Knowledge Base</h2>
        <p className="mt-1 text-sm text-m-text-muted">
          Upload your organization&apos;s FAQ and Troubleshooting content using the Excel template.
        </p>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-m-success-border bg-m-success-bg p-4 text-sm text-m-success-dark shadow-sm animate-in fade-in"
        >
          <Icon name="check-circle" size="sm" className="mt-0.5 text-m-success shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{successMessage}</p>
            <p className="text-xs text-m-success-dark/80 mt-0.5">
              The updated FAQ and Troubleshoot articles are now live for your team in the Customer CX workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-m-success-dark/60 hover:text-m-success-dark text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Validation Errors Banner */}
      {validationErrors && validationErrors.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-m-error-border bg-m-error-bg p-4 text-sm text-m-error-dark shadow-sm"
        >
          <Icon name="alert-triangle" size="sm" className="mt-0.5 text-m-error shrink-0" />
          <div className="flex-1 space-y-1">
            <p className="font-bold">Validation Failed</p>
            <p className="text-xs text-m-error-dark/80">
              The uploaded file contains errors. Your existing Knowledge Base was kept unchanged. Please fix the issues below and upload again:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
              {validationErrors.map((err, i) => (
                <li key={i} className="leading-relaxed">
                  {err}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setValidationErrors(null)}
            className="text-m-error-dark/60 hover:text-m-error-dark text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* General Error Banner */}
      {generalError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-m-error-border bg-m-error-bg p-4 text-sm text-m-error-dark shadow-sm"
        >
          <Icon name="alert-circle" size="sm" className="mt-0.5 text-m-error shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{generalError}</p>
            <p className="text-xs text-m-error-dark/80 mt-0.5">
              Your previous Knowledge Base data remains safe and unmodified.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGeneralError(null)}
            className="text-m-error-dark/60 hover:text-m-error-dark text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview & Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="default">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
              Current Status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  hasContent ? "bg-m-success" : "bg-m-neutral-400"
                }`}
              />
              <span className="font-bold text-base text-m-text">
                {hasContent ? "Configured & Active" : "No Content Uploaded"}
              </span>
            </div>
            <p className="mt-1 text-xs text-m-text-muted">
              Last updated: <span className="font-medium text-m-text">{formattedLastUpdated}</span>
            </p>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
              FAQ Entries
            </p>
            <p className="mt-2 text-2xl font-extrabold text-m-text">
              {loading ? "..." : (status?.faqCount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-m-text-muted">
              Across {data?.faq?.length ?? 0} section(s)
            </p>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
              Troubleshoot Guides
            </p>
            <p className="mt-2 text-2xl font-extrabold text-m-text">
              {loading ? "..." : (status?.troubleshootCount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-m-text-muted">
              Across {data?.troubleshoot?.length ?? 0} section(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Upload & Template Actions */}
      <div className="rounded-xl border border-m-border bg-m-surface p-6 shadow-sm">
        <h3 className="text-base font-bold text-m-text">Upload & Template</h3>
        <p className="mt-1 text-xs text-m-text-muted">
          Download our pre-structured template, add your questions and answers in the FAQ and Troubleshoot sheets, and upload the completed workbook.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Icon name="download" size="xs" />}
            onClick={handleDownloadTemplate}
          >
            Download Template
          </Button>

          <div className="relative flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              id="kb-file-upload"
              className="sr-only"
            />
            <label
              htmlFor="kb-file-upload"
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-m-border px-4 py-2 text-sm text-m-text hover:bg-m-surface-bg transition-colors"
            >
              <span className="truncate">
                {selectedFile ? (
                  <span className="font-semibold text-m-primary flex items-center gap-2">
                    <Icon name="file-text" size="xs" />
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                ) : (
                  <span className="text-m-text-muted flex items-center gap-2">
                    <Icon name="upload" size="xs" />
                    Select or browse completed .xlsx file...
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded bg-m-surface-bg px-2 py-0.5 text-xs font-semibold text-m-text-muted">
                Browse
              </span>
            </label>
          </div>

          <Button
            type="button"
            variant="primary"
            disabled={!selectedFile || uploading}
            loading={uploading}
            leftIcon={<Icon name="upload" size="xs" />}
            onClick={handleUpload}
          >
            Upload Knowledge Base
          </Button>
        </div>

        {hasContent && (
          <p className="mt-3 text-xs text-m-text-muted">
            <Icon name="info" size="xs" className="inline mr-1 align-text-bottom text-m-primary" />
            Uploading a new file will replace all existing Knowledge Base entries for your organization.
          </p>
        )}
      </div>

      {/* Sections Summary Preview */}
      {hasContent && data && (
        <div className="rounded-xl border border-m-border bg-m-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-m-text">Active Sections Overview</h3>
            <Badge variant="neutral" appearance="subtle">
              Live Content
            </Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-m-primary uppercase tracking-wider mb-2">
                FAQ Sections ({data.faq.length})
              </h4>
              <div className="space-y-2">
                {data.faq.map((group, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-m-border/60 bg-m-surface-bg/50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-m-text">{group.section}</span>
                    <span className="text-xs text-m-text-muted font-mono">
                      {group.items.length} question(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-m-primary uppercase tracking-wider mb-2">
                Troubleshoot Sections ({data.troubleshoot.length})
              </h4>
              <div className="space-y-2">
                {data.troubleshoot.map((group, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-m-border/60 bg-m-surface-bg/50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-m-text">{group.section}</span>
                    <span className="text-xs text-m-text-muted font-mono">
                      {group.items.length} guide(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
