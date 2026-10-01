import { describe, expect, it } from 'vitest';
import { discoverFacetAttributes, facetLabel, isNumericFacet } from './dynamicFacets';

describe('Algolia facet discovery', () => {
  const results = {
    _rawResults: [{
      facets: { categories: {}, name: {}, price: {}, productType: {}, stockStatus: {} },
      facets_stats: { price: { min: 16.99, max: 1299 } }
    }]
  };

  it('discovers every returned facet without a fixed attribute list', () => {
    expect(discoverFacetAttributes([], { results })).toEqual([
      'categories', 'name', 'price', 'productType', 'stockStatus'
    ]);
    expect(discoverFacetAttributes([], { results: { _rawResults: [{ facets: { brand: {} } }] } }))
      .toEqual(['brand']);
  });

  it('respects Algolia display ordering and hidden facets', () => {
    const ordered = { ...results, renderingContent: { facetOrdering: { facets: { order: ['stockStatus', 'name'] } } } };
    expect(discoverFacetAttributes(['stockStatus', 'name'], { results: ordered })).toEqual(['stockStatus', 'name']);
    ordered.renderingContent.facetOrdering.facets.order = [];
    expect(discoverFacetAttributes([], { results: ordered })).toEqual([]);
  });

  it('uses numeric statistics rather than attribute names to choose ranges', () => {
    expect(isNumericFacet('price', results)).toBe(true);
    expect(isNumericFacet('name', results)).toBe(false);
    expect(isNumericFacet('price', { _rawResults: [{ facets: { price: {} } }] })).toBe(false);
    expect(isNumericFacet('weight', { _rawResults: [{ facets_stats: { weight: { min: 1, max: 20 } } }] })).toBe(true);
  });

  it('handles an initial response with no facets', () => {
    expect(discoverFacetAttributes([], { results: {} })).toEqual([]);
  });

  it('formats arbitrary attribute names for headings', () => {
    expect(facetLabel('productType')).toBe('Product Type');
    expect(facetLabel('dimensions.total_weight')).toBe('Dimensions Total Weight');
  });
});
