import { describe, expect, it } from "vitest";
import { productPageFromParam, productPageHref } from "./product-pagination";

describe("product pagination URLs", () => {
  it("reads direct links to later pages", () => {
    expect(productPageFromParam(new URL("https://studio.test/products?page=3").searchParams.get("page"))).toBe(3);
  });

  it.each([null, "", "0", "-2", "1.5", "abc", "3abc", "Infinity", "9007199254740992"])("defaults invalid page %s to page one", (value) => {
    expect(productPageFromParam(value)).toBe(1);
  });

  it("updates only the page and preserves the path, query and hash", () => {
    expect(productPageHref("https://studio.test/fr-FR/products?foo=bar&page=2#catalog", 3))
      .toBe("/fr-FR/products?foo=bar&page=3#catalog");
  });

  it("adds a page parameter and resets it to one", () => {
    const third = productPageHref("https://studio.test/products", 3);
    expect(third).toBe("/products?page=3");
    expect(productPageHref(`https://studio.test${third}`, 1)).toBe("/products?page=1");
  });
});
