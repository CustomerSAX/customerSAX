"use client";

/**
 * ProductDetailView — Product Detail Page
 *
 * Restyled onto the shared entity-detail design system
 * (`@/components/detail`: DetailPage / EntityHeader / EntityTabs / SummaryGrid /
 * ContentGrid / SectionCard / QuickActions …). Presentation only — every data
 * hook, field, and behavior below is unchanged from the previous implementation:
 *
 * - useProductDetail(id) drives loading / error / not-found / loaded states.
 * - General: product name, key, id, description, price mode, tax category,
 *   categories (ancestor breadcrumb, last segment bold).
 * - Variants: table of variant id / sku / key / image (with error fallback) /
 *   price / inventory quantity.
 *
 * No field is fabricated: anything the mock design shows but the backend does
 * not return (multi-warehouse inventory split, margin %, compare-at price,
 * discounts, service-insight analytics, comments) renders an honest
 * <CardEmpty/> instead of invented numbers.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
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
import {
  DetailPage,
  BackLink,
  EntityHeader,
  EntityTabs,
  SummaryGrid,
  SummaryCard,
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  InfoList,
  InfoRow,
  CardEmpty,
  type EntityTab,
} from "@/components/detail";
import { useProductDetail } from "../hooks/use-products";
import type { VariantDetailRow, CategoryBreadcrumb } from "../types/product-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalizes a value that may be "", null, or the legacy "--" sentinel to `null`
 *  so downstream components can render a single, honest "—" empty state. */
function dash(value: string | null | undefined): string | null {
  if (value == null || value === "" || value === "--") return null;
  return value;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders a category with its full ancestor breadcrumb. */
function CategoryCrumb({ category }: { category: CategoryBreadcrumb }) {
  const allParts = [...category.ancestors, category.name];
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-m-text-muted">
      {allParts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <Icon name="chevron-right" size="xs" className="text-m-text-muted/50" />}
          <span className={i === allParts.length - 1 ? "font-semibold text-m-text" : undefined}>
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
      <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-m-md border border-m-border bg-m-surface-2">
        <span className="px-1 text-center text-[9px] leading-tight text-m-text-muted">
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
      className="h-[50px] w-[50px] shrink-0 rounded-m-md border border-m-border bg-m-surface-2 object-contain"
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
// Tabs
// ---------------------------------------------------------------------------

const TABS: EntityTab[] = [
  { id: "general", label: "General", icon: "info" },
  { id: "inventory", label: "Inventory", icon: "warehouse" },
  { id: "variants", label: "Variants", icon: "layers" },
  { id: "pricing", label: "Pricing", icon: "dollar-sign" },
  { id: "insights", label: "Service Insights", icon: "bar-chart-2" },
  { id: "comments", label: "Comments", icon: "message-square" },
];

// ---------------------------------------------------------------------------
// ProductDetailView
// ---------------------------------------------------------------------------

export interface ProductDetailViewProps {
  id: string;
}

export function ProductDetailView({ id }: ProductDetailViewProps) {
  const router = useRouter();
  const { product, loading, error } = useProductDetail(id);
  const [activeTab, setActiveTab] = useState<string>("general");

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
      <DetailPage>
        <BackLink href="/products">Back to Products</BackLink>
        <EntityHeader title={<Skeleton width={280} height={26} />} meta={<Skeleton width={320} height={14} />} />
        <SectionCard title="Product Information" icon="info">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton width={80} height={12} />
                <Skeleton width="90%" height={16} />
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Variants" icon="layers">
          <Skeleton width="100%" height={120} />
        </SectionCard>
      </DetailPage>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <DetailPage>
        <BackLink href="/products">Back to Products</BackLink>
        <EntityHeader title="Product Details" />
        <SectionCard>
          <EmptyState icon="package" title="Failed to Load Product" description={error} action={BackButton} />
        </SectionCard>
      </DetailPage>
    );
  }

  // -------------------------------------------------------------------------
  // Not-found state
  // -------------------------------------------------------------------------

  if (!product) {
    return (
      <DetailPage>
        <BackLink href="/products">Back to Products</BackLink>
        <EntityHeader title="Product Not Found" />
        <SectionCard>
          <EmptyState
            icon="package"
            title="Product Not Found"
            description={`No product was found with ID: ${id}`}
            action={BackButton}
          />
        </SectionCard>
      </DetailPage>
    );
  }

  // -------------------------------------------------------------------------
  // Loaded state
  // -------------------------------------------------------------------------

  const firstVariant = product.variants[0];
  const summarySku = dash(firstVariant?.sku);
  const summaryCategory = dash(product.categories[0]?.name);
  const summaryPrice = dash(firstVariant?.unitPrice);

  const description = dash(product.productDescription);

  return (
    <DetailPage>
      <BackLink href="/products">Back to Products</BackLink>

      <EntityHeader
        title={`Product: ${product.productName}`}
        meta={`Key: ${product.key} • ID: ${product.id}`}
      />

      <EntityTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <SummaryGrid>
        <SummaryCard icon="tag" label="SKU" value={summarySku ?? "—"} />
        <SummaryCard icon="folder" label="Category" value={summaryCategory ?? "—"} />
        <SummaryCard icon="dollar-sign" label="Price" value={summaryPrice ?? "—"} />
        <SummaryCard icon="layers" label="Variants" value={product.variants.length} />
        <SummaryCard icon="check-circle" label="Publish Status" value="—" />
      </SummaryGrid>

      <ContentGrid>
        <MainColumn span={8}>
          {activeTab === "general" && (
            <>
              <SectionCard title="Product Information" icon="info">
                <InfoList columns={2}>
                  <InfoRow label="Product Name" value={dash(product.productName)} />
                  <InfoRow label="Product Key" value={dash(product.key)} />
                  <InfoRow label="Product ID" value={dash(product.id)} mono />
                  <InfoRow label="Price Mode" value={dash(product.priceMode)} />
                  <InfoRow label="Tax Category" value={dash(product.taxCategory)} />
                </InfoList>
                <div className="mt-4 flex flex-col gap-0.5">
                  <span className="text-[12px] font-medium text-m-text-muted">Product Description</span>
                  <p className={`text-[13.5px] leading-snug ${description ? "text-m-text" : "text-m-text-subtle"}`}>
                    {description ?? "—"}
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Categories" icon="folder">
                {product.categories.length === 0 ? (
                  <CardEmpty icon="folder" title="No categories assigned" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {product.categories.map((cat) => (
                      <CategoryCrumb key={cat.id} category={cat} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {activeTab === "inventory" && (
            <SectionCard title="Inventory" icon="warehouse">
              <CardEmpty
                icon="warehouse"
                title="Multi-warehouse breakdown unavailable"
                hint="The connected commercetools backend does not return a per-warehouse inventory split — only total available quantity per variant, shown on the Variants tab."
              />
            </SectionCard>
          )}

          {activeTab === "variants" && (
            <SectionCard title={`Variants (${product.variants.length})`} icon="layers">
              <VariantsTable variants={product.variants} />
            </SectionCard>
          )}

          {activeTab === "pricing" && (
            <>
              <SectionCard title="Pricing" icon="dollar-sign">
                <InfoList>
                  <InfoRow label="Price Mode" value={dash(product.priceMode)} />
                </InfoList>
                {product.variants.length > 0 && (
                  <div className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {product.variants.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>{v.sku}</TableCell>
                            <TableCell>{v.unitPrice}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Margin & Discounts" icon="trending-up">
                <CardEmpty
                  icon="trending-up"
                  title="Margin and discount data unavailable"
                  hint="Margin %, compare-at price, and discount data aren't returned by the connected backend."
                />
              </SectionCard>
            </>
          )}

          {activeTab === "insights" && (
            <SectionCard title="Service Insights" icon="bar-chart-2">
              <CardEmpty
                icon="bar-chart-2"
                title="No service insights available"
                hint="Top support issues, return reasons, and knowledge-base suggestions for this product aren't provided by the connected backend."
              />
            </SectionCard>
          )}

          {activeTab === "comments" && (
            <SectionCard title="Comments" icon="message-square">
              <CardEmpty icon="message-square" title="No comments yet" hint="Internal notes on this product aren't backed by the connected backend." />
            </SectionCard>
          )}
        </MainColumn>

        <SideColumn span={4}>
          <SectionCard title="Actions" icon="zap">
            <CardEmpty
              icon="lock"
              title="No product actions available"
              hint="Editing, duplicating, and archiving products aren't wired to the commerce backend in this environment yet."
            />
          </SectionCard>
        </SideColumn>
      </ContentGrid>
    </DetailPage>
  );
}
