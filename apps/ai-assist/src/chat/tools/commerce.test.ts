import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCustomerContactTargetsTool,
  updateCustomerContactNumberTool,
  buildCommerceTools,
  COMMERCE_WRITE_DENIED,
} from "./commerce.js";
import * as bffModule from "../../commerce/graphql-client.js";
import { contextStorage } from "../system-prompt.js";

describe("Commerce Contact Tools - End-to-End AI Resolution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCustomerContactTargetsTool", () => {
    it("fetches customer contact targets successfully", async () => {
      const mockResult = {
        id: "cust-1",
        email: "alice@example.com",
        version: 3,
        targets: [
          { id: "addr-1", label: "123 Main St, Boston, MA", phone: "555-0100" },
        ],
      };

      vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
        customerContactTargets: mockResult,
      });

      const execute = getCustomerContactTargetsTool.execute as (args: { customerId: string }) => Promise<unknown>;
      const result = await execute({ customerId: "cust-1" });

      expect(result).toEqual(mockResult);
    });

    it("returns an error if customer is not found", async () => {
      vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
        customerContactTargets: null,
      });

      const execute = getCustomerContactTargetsTool.execute as (args: { customerId: string }) => Promise<unknown>;
      const result = await execute({ customerId: "nonexistent" });

      expect(result).toEqual({ error: "Customer not found or has no recorded addresses." });
    });
  });

  describe("updateCustomerContactNumberTool", () => {
    it("executes customer contact number update with version-bound mutation", async () => {
      const mockUpdate = {
        id: "cust-1",
        version: 4,
        addressId: "addr-1",
        phone: "555-9999",
      };

      vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
        updateCustomerContactNumber: mockUpdate,
      });

      const execute = updateCustomerContactNumberTool.execute as (args: {
        customerId: string;
        addressId: string;
        expectedVersion: number;
        phone: string;
      }) => Promise<unknown>;

      const result = await execute({
        customerId: "cust-1",
        addressId: "addr-1",
        expectedVersion: 3,
        phone: "555-9999",
      });

      expect(result).toEqual({
        success: true,
        customer: mockUpdate,
        message: "Updated phone number for address addr-1 to 555-9999",
      });
    });

    it("blocks update_customer_contact_number in buildCommerceTools when approval is missing", async () => {
      const tools = buildCommerceTools({ pending: false });
      const guardedTool = tools.update_customer_contact_number;

      // Run within session context having permission but NO approval
      const context = {
        userEmail: "agent@csa.local",
        userRole: "Support Agent",
        projectKey: "test-proj",
        canUpdateCustomers: true,
        approval: null, // No approval!
      };

      const result = await contextStorage.run(context as any, async () => {
        const execute = guardedTool.execute as (args: any) => Promise<any>;
        return execute({
          customerId: "cust-1",
          addressId: "addr-1",
          expectedVersion: 3,
          phone: "555-9999",
        });
      });

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("APPROVAL_REQUIRED");
    });

    it("blocks update_customer_contact_number when rep lacks canUpdateCustomers permission", async () => {
      const tools = buildCommerceTools({ pending: false });
      const guardedTool = tools.update_customer_contact_number;

      // Run within session context with approval but NO permission
      const context = {
        userEmail: "agent@csa.local",
        userRole: "Support Agent",
        projectKey: "test-proj",
        canUpdateCustomers: false,
        approval: { kind: "approval_card" },
      };

      const result = await contextStorage.run(context as any, async () => {
        const execute = guardedTool.execute as (args: any) => Promise<any>;
        return execute({
          customerId: "cust-1",
          addressId: "addr-1",
          expectedVersion: 3,
          phone: "555-9999",
        });
      });

      expect(result).toHaveProperty("error");
      expect(result.error).toBe(COMMERCE_WRITE_DENIED);
    });

    it("allows execution when both canUpdateCustomers permission and approval_card are present", async () => {
      const tools = buildCommerceTools({ pending: false });
      const guardedTool = tools.update_customer_contact_number;

      const mockUpdate = {
        id: "cust-1",
        version: 4,
        addressId: "addr-1",
        phone: "555-9999",
      };

      vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
        updateCustomerContactNumber: mockUpdate,
      });

      const context = {
        userEmail: "agent@csa.local",
        userRole: "Support Agent",
        projectKey: "test-proj",
        canUpdateCustomers: true,
        approval: { kind: "approval_card" },
      };

      const result = await contextStorage.run(context as any, async () => {
        const execute = guardedTool.execute as (args: any) => Promise<any>;
        return execute({
          customerId: "cust-1",
          addressId: "addr-1",
          expectedVersion: 3,
          phone: "555-9999",
        });
      });

      expect(result).toEqual({
        success: true,
        customer: mockUpdate,
        message: "Updated phone number for address addr-1 to 555-9999",
      });
    });
  });
});
