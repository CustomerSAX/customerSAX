'use client';

import { useState } from 'react';
import { useDynamicWidgets, useInstantSearch } from 'react-instantsearch';
import { Accordion } from '@csa/ui';
import { discoverFacetAttributes, facetLabel, isNumericFacet } from '../config/dynamicFacets';
import {
  FacetAccordionItem,
  NumericRangeAccordionItem,
  ResetSearchButton,
  SelectedRefinements
} from './SearchFilters';

function DynamicFacet({ attribute }: { attribute: string }) {
  const { results, indexUiState } = useInstantSearch();
  const numeric = isNumericFacet(attribute, results) || attribute in (indexUiState.range ?? {});
  // Keep the range widget mounted when a zero-result search has no facet stats.
  const [wasNumeric, setWasNumeric] = useState(numeric);
  if (numeric && !wasNumeric) setWasNumeric(true);
  const label = facetLabel(attribute);
  return numeric || wasNumeric ? (
    <NumericRangeAccordionItem config={{ attribute, label: `${label} Range` }} />
  ) : (
    <FacetAccordionItem config={{ attribute, label, limit: 10, showMoreLimit: 100 }} />
  );
}

export function DynamicSearchFilters() {
  const { attributesToRender } = useDynamicWidgets({
    facets: ['*'],
    maxValuesPerFacet: 100,
    transformItems: discoverFacetAttributes
  });
  const { indexUiState } = useInstantSearch();
  // URL refinements must mount even before the first discovery response arrives.
  const attributes = [...new Set([
    ...attributesToRender,
    ...Object.keys(indexUiState.refinementList ?? {}),
    ...Object.keys(indexUiState.range ?? {})
  ])];
  return (
    <div className="space-y-3">
      <ResetSearchButton />
      <SelectedRefinements />
      <Accordion type="multiple" className="space-y-3 divide-y-0 rounded-none border-none bg-transparent">
        {attributes.map((attribute) => <DynamicFacet key={attribute} attribute={attribute} />)}
      </Accordion>
    </div>
  );
}
