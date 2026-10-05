interface FacetResults {
  renderingContent?: { facetOrdering?: { facets?: { order?: string[] } } };
  _rawResults?: Array<{
    facets?: Record<string, unknown>;
    facets_stats?: Record<string, { min?: number; max?: number }>;
  }>;
}

// The wildcard response contains unmounted facets too; SearchResults.facets
// only contains facets already registered by a widget.
export function discoverFacetAttributes(items: string[], { results }: { results: FacetResults }): string[] {
  if (results.renderingContent?.facetOrdering?.facets?.order !== undefined) {
    return [...new Set(items)];
  }
  return Object.keys(results._rawResults?.[0]?.facets ?? {});
}

export function isNumericFacet(attribute: string, results: FacetResults): boolean {
  return Boolean(results._rawResults?.some((result) => result.facets_stats?.[attribute]));
}

export function facetLabel(attribute: string): string {
  return attribute
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
