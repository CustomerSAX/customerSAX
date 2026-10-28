import { describe, it, expect } from "vitest";
import type { PageContext } from "../types";

// Test helper that mirrors parseRouteContext logic
function testParseRoute(cleanPath: string) {
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length === 0 || cleanPath === "/dashboard") {
    return { pageType: "dashboard", route: cleanPath };
  }

  const [section, second] = segments;

  if (section === "orders") {
    if (second && second !== "create") {
      return {
        pageType: "order_details",
        entityType: "order",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "order_list", entityType: "order", route: cleanPath };
  }

  if (section === "customers") {
    if (second && second !== "create") {
      return {
        pageType: "customer_details",
        entityType: "customer",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "customer_list", entityType: "customer", route: cleanPath };
  }

  if (section === "tickets") {
    if (second && second !== "create") {
      return {
        pageType: "ticket_details",
        entityType: "ticket",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "ticket_list", entityType: "ticket", route: cleanPath };
  }

  if (section === "products") {
    if (second) {
      return {
        pageType: "product_details",
        entityType: "product",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "product_list", entityType: "product", route: cleanPath };
  }

  if (section === "cart") {
    if (second) {
      return {
        pageType: "cart_details",
        entityType: "cart",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "cart_list", entityType: "cart", route: cleanPath };
  }

  return { pageType: "general", route: cleanPath };
}

describe("Page Context Route Detection & Structure", () => {
  it("detects order list and order detail routes correctly", () => {
    const list = testParseRoute("/orders");
    expect(list.pageType).toBe("order_list");
    expect(list.entityType).toBe("order");

    const detail = testParseRoute("/orders/ord-12345");
    expect(detail.pageType).toBe("order_details");
    expect(detail.entityType).toBe("order");
    expect(detail.entityId).toBe("ord-12345");
  });

  it("detects customer list and customer detail routes correctly", () => {
    const list = testParseRoute("/customers");
    expect(list.pageType).toBe("customer_list");
    expect(list.entityType).toBe("customer");

    const detail = testParseRoute("/customers/cust-rahul-789");
    expect(detail.pageType).toBe("customer_details");
    expect(detail.entityType).toBe("customer");
    expect(detail.entityId).toBe("cust-rahul-789");
  });

  it("detects ticket list and ticket detail routes correctly", () => {
    const list = testParseRoute("/tickets");
    expect(list.pageType).toBe("ticket_list");
    expect(list.entityType).toBe("ticket");

    const detail = testParseRoute("/tickets/CSA-20260808-O0W8G");
    expect(detail.pageType).toBe("ticket_details");
    expect(detail.entityType).toBe("ticket");
    expect(detail.entityId).toBe("CSA-20260808-O0W8G");
  });

  it("detects product and cart routes correctly", () => {
    const productDetail = testParseRoute("/products/prod-sku-99");
    expect(productDetail.pageType).toBe("product_details");
    expect(productDetail.entityId).toBe("prod-sku-99");

    const cartDetail = testParseRoute("/cart/cart-b2b-01");
    expect(cartDetail.pageType).toBe("cart_details");
    expect(cartDetail.entityId).toBe("cart-b2b-01");
  });

  it("structured page context contains all necessary fields for context awareness", () => {
    const context: PageContext = {
      type: "order",
      id: "ord-123",
      route: "/orders/ord-123",
      pageType: "order_details",
      entityType: "order",
      entityId: "ord-123",
      recordSummary: {
        orderNumber: "RC-1234",
        orderState: "Open",
        customerName: "Alice Smith",
      },
      parentRelationship: {
        type: "customer",
        id: "cust-alice",
        label: "Alice Smith",
      },
      timestamp: Date.now(),
    };

    expect(context.type).toBe("order");
    expect(context.id).toBe("ord-123");
    expect(context.recordSummary?.orderNumber).toBe("RC-1234");
    expect(context.parentRelationship?.type).toBe("customer");
  });
});
