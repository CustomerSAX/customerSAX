"use client";

/**
 * ProductDetailView — Product Detail Page (100% parity with CT-CSA-Standalone product-detail.tsx)
 *
 * Features:
 * - PageHeader: eyebrow="Catalog Details", product name title, description (name | key | id)
 * - "← Back to Products" secondary action button
 * - Loading state: skeleton card
 * - Error state: EmptyState with 🛍️ icon + back button
 * - Not-found state: EmptyState with back button
 * - General Information collapsible Panel:
 *   - Product Name (read-only display)
 *   - Product Description (read-only display)
 *   - Product Key (read-only display)
 *   - Categories with ancestor > breadcrumb rendering (last name bold)
 *   - Price Mode
 *   - Tax Category
 * - Variants collapsible Panel ("Variants (N)" header):
 *   - Table columns: Variant ID, SKU, Key, Image (50×50 thumbnail + error fallback), Price, Inventory/Quantity
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Skeleton,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@csa/ui";
import { useProductDetail } from "../hooks/use-products";
import type { VariantDetailRow, CategoryBreadcrumb } from "../types/product-types";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders a single read-only field label + value pair. */
function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
        {label}
      </span>
      <span className="text-sm text-m-text break-words">
        {value || "--"}
      </span>
    </div>
  );
}

/** Renders a category with its full ancestor breadcrumb. */
function CategoryCrumb({ category }: { category: CategoryBreadcrumb }) {
  const allParts = [...category.ancestors, category.name];
  return (
    <div className="flex items-center flex-wrap gap-1 text-xs text-m-text-muted">
      {allParts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <Icon name="chevron-right" size="xs" className="text-m-text-muted/50" />
          )}
          <span
            className={
              i === allParts.length - 1
                ? "font-semibold text-m-text"
                : undefined
            }
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Variant image with error fallback. */
function VariantImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="h-[50px] w-[50px] rounded border border-m-border bg-m-surface-2 flex items-center justify-center shrink-0">
        <span className="text-[9px] text-m-text-muted text-center leading-tight px-1">
          No image
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={50}
      height={50}
      className="h-[50px] w-[50px] rounded border border-m-border object-contain bg-m-surface-2 shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ---------------------------------------------------------------------------
// Variants table
// ---------------------------------------------------------------------------

function VariantsTable({ variants }: { variants: VariantDetailRow[] }) {
  if (variants.length === 0) {
    return (
      <EmptyState
        icon="package"
        title="No Variants"
        description="This product has no variant data."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Variant ID</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Image</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Inventory (Qty)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {variants.map((v) => (
          <TableRow key={v.id}>
            <TableCell className="font-mono text-m-text-muted">{v.id}</TableCell>
            <TableCell>{v.sku}</TableCell>
            <TableCell className="text-m-text-muted">{v.key}</TableCell>
            <TableCell>
              <VariantImage url={v.imageUrl} alt={`Variant ${v.sku}`} />
            </TableCell>
            <TableCell>{v.unitPrice}</TableCell>
            <TableCell>{v.quantity}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// ProductDetailView
// ---------------------------------------------------------------------------

export interface ProductDetailViewProps {
  id: string;
}

export function ProductDetailView({ id }: ProductDetailViewProps) {
  const router = useRouter();
  const { product, loading, error } = useProductDetail(id);

  const handleBack = () => router.push("/products");

  const BackButton = (
    <Button variant="secondary" onClick={handleBack} size="md">
      <Icon name="arrow-left" size="sm" className="mr-1.5" />
      Back to Products
    </Button>
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={<Skeleton width={300} height={28} rounded="sm" />}
          subtitle={<Skeleton width={420} height={16} rounded="sm" />}
          breadcrumbs={
            <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
              Catalog Details
            </span>
          }
          actions={BackButton}
        />
        <Panel title="General Information" collapsible defaultExpanded>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-5 py-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton width={80} height={12} rounded="sm" />
                <Skeleton width="90%" height={16} rounded="sm" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Variants" collapsible defaultExpanded>
          <div className="px-5 py-6">
            <Skeleton width="100%" height={120} rounded="md" />
          </div>
        </Panel>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Product Details"
          breadcrumbs={
            <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
              Catalog Details
            </span>
          }
          actions={BackButton}
        />
        <Panel>
          <div className="py-16 px-5">
            <EmptyState
              icon="package"
              title="Failed to Load Product"
              description={error}
              action={BackButton}
            />
          </div>
        </Panel>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Not-found state
  // -------------------------------------------------------------------------

  if (!product) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Product Not Found"
          breadcrumbs={
            <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
              Catalog Details
            </span>
          }
          actions={BackButton}
        />
        <Panel>
          <div className="py-16 px-5">
            <EmptyState
              icon="package"
              title="Product Not Found"
              description={`No product was found with ID: ${id}`}
              action={BackButton}
            />
          </div>
        </Panel>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loaded state
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title={product.productName}
        subtitle={`${product.productName} | ${product.key} | ${product.id}`}
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            Catalog Details
          </span>
        }
        actions={BackButton}
      />

      {/* General Information */}
      <Panel title="General Information" collapsible defaultExpanded>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-5 py-5">
          <ReadOnlyField label="Product Name" value={product.productName} />
          <ReadOnlyField label="Product Key" value={product.key} />
          <div className="sm:col-span-2">
            <ReadOnlyField
              label="Product Description"
              value={product.productDescription}
            />
          </div>
          <ReadOnlyField label="Price Mode" value={product.priceMode} />
          <ReadOnlyField label="Tax Category" value={product.taxCategory} />

          {/* Categories */}
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
              Categories
            </span>
            {product.categories.length === 0 ? (
              <span className="text-sm text-m-text">--</span>
            ) : (
              <div className="flex flex-col gap-2">
                {product.categories.map((cat: CategoryBreadcrumb) => (
                  <CategoryCrumb key={cat.id} category={cat} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Variants */}
      <Panel
        title={`Variants (${product.variants.length})`}
        collapsible
        defaultExpanded
      >
        <div className="px-5 py-4">
          <VariantsTable variants={product.variants} />
        </div>
      </Panel>
    </div>
  );
}
