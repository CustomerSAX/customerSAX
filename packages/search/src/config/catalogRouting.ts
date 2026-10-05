interface CatalogIndexState {
  query?: string;
  page?: number;
  refinementList?: Record<string, string[]>;
  range?: Record<string, string>;
  sortBy?: string;
}
interface CatalogRoute extends Omit<CatalogIndexState, "page"> {
  page?: number | string;
}

export function catalogStateMapping(indexName: string) {
  return {
    stateToRoute(state: Record<string, CatalogIndexState>): CatalogRoute {
      const index = state[indexName] ?? {};
      return {
        query: index.query || undefined,
        page: index.page ?? 1,
        refinementList: index.refinementList,
        range: index.range,
        sortBy: index.sortBy
      };
    },
    routeToState(route: CatalogRoute): Record<string, CatalogIndexState> {
      const page = Number(route.page);
      return {
        [indexName]: {
          query: typeof route.query === "string" ? route.query : "",
          page: Number.isSafeInteger(page) && page > 0 ? page : 1,
          refinementList: route.refinementList,
          range: route.range,
          sortBy: route.sortBy
        }
      };
    }
  };
}
