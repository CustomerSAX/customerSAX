"use client";

import { usePagination, useHits } from "react-instantsearch";
import { TablePagination } from "@csa/ui";

export interface SearchPaginationProps {
  className?: string;
  padding?: number;
}

export function SearchPagination({ className = "", padding = 2 }: SearchPaginationProps) {
  const { currentRefinement, nbPages, refine } = usePagination({ padding });
  const { results } = useHits();
  if (!results?.nbHits) return null;
  return (
    <div className={`overflow-hidden rounded-m-lg border border-m-border ${className}`}>
      <TablePagination
        page={currentRefinement + 1}
        totalPages={Math.max(1, nbPages)}
        totalItems={results.nbHits}
        pageSize={results.hitsPerPage}
        onPageChange={(page) => refine(page - 1)}
      />
    </div>
  );
}
