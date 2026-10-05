import { describe, expect, it } from "vitest";
import { catalogStateMapping } from "./catalogRouting";

describe("Algolia Products URL state", () => {
  const mapping = catalogStateMapping("catalog");
  it("loads page three from the URL", () => {
    expect(mapping.routeToState({ page: "3" }).catalog.page).toBe(3);
  });
  it.each(["bad", "0", "-3", "1.5"])("defaults invalid page %s to one", (page) => {
    expect(mapping.routeToState({ page }).catalog.page).toBe(1);
  });
  it("round-trips search, pagination, filters, price, and replica sorting", () => {
    const state = {
      catalog: {
        query: "chair",
        page: 3,
        refinementList: { productType: ["Furniture"] },
        range: { price: "10:200" },
        sortBy: "catalog_price_asc"
      }
    };
    expect(mapping.routeToState(mapping.stateToRoute(state))).toEqual(state);
  });
});
