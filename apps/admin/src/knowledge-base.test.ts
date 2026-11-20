import { describe, expect, it, vi } from "vitest";
import { resolvers } from "./schema.js";

vi.mock("@csa/mongodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@csa/mongodb")>();
  return {
    ...actual,
    getKnowledgeBaseByOrganization: vi.fn(async (_clientId: string) => ({
      faq: [
        {
          section: "Account",
          items: [{ id: "1", question: "How to login?", answer: "Use email" }]
        }
      ],
      troubleshoot: [],
      status: {
        lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
        faqCount: 1,
        troubleshootCount: 0
      }
    })),
    replaceKnowledgeBase: vi.fn(async (_clientId: string, items: any[]) => ({
      count: items.length,
      status: {
        lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
        faqCount: items.filter((i) => i.type === "faq").length,
        troubleshootCount: items.filter((i) => i.type === "troubleshoot").length
      }
    })),
    deleteKnowledgeBaseByOrganization: vi.fn(async () => ({
      deletedCount: 1
    }))
  };
});

describe("Admin Subgraph Knowledge Base Resolvers", () => {
  it("resolves adminKnowledgeBase query", async () => {
    const res = await (resolvers.Query as any).adminKnowledgeBase(null, {
      clientId: "org-123"
    });

    expect(res).toBeDefined();
    expect(res.faq).toHaveLength(1);
    expect(res.faq[0].section).toBe("Account");
    expect(res.status.faqCount).toBe(1);
    expect(res.status.lastUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("resolves adminReplaceKnowledgeBase mutation", async () => {
    const items = [
      { type: "faq", section: "Account", question: "Q?", answer: "A!" },
      { type: "troubleshoot", section: "Login", question: "T?", answer: "Fix!" }
    ];

    const res = await (resolvers.Mutation as any).adminReplaceKnowledgeBase(null, {
      clientId: "org-123",
      items
    });

    expect(res.ok).toBe(true);
    expect(res.count).toBe(2);
    expect(res.status.faqCount).toBe(1);
    expect(res.status.troubleshootCount).toBe(1);
  });

  it("resolves adminDeleteKnowledgeBase mutation", async () => {
    const res = await (resolvers.Mutation as any).adminDeleteKnowledgeBase(null, {
      clientId: "org-123"
    });

    expect(res).toBe(true);
  });
});

