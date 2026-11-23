import { describe, expect, it } from "vitest";
import { authorize, orgAdminOnlyFields, clientScopedAdminFields } from "./auth.js";

describe("Admin Authorization & Permission Rules", () => {
  const superadminContext = {
    userRole: "superadmin",
    userEmail: "super@csa.local",
    clientId: undefined,
    userIsOrgAdmin: false
  };

  const orgAdminContext = {
    userRole: "admin",
    userEmail: "orgadmin@company.com",
    clientId: "client-1",
    userIsOrgAdmin: true
  };

  const regularAdminContext = {
    userRole: "admin",
    userEmail: "regularadmin@company.com",
    clientId: "client-1",
    userIsOrgAdmin: false
  };

  const agentContext = {
    userRole: "agent",
    userEmail: "agent@company.com",
    clientId: "client-1",
    userIsOrgAdmin: false
  };

  describe("Permission Allowlist Classifications", () => {
    it("classifies project creation and organization management under orgAdminOnlyFields", () => {
      expect(orgAdminOnlyFields.has("adminCreateProject")).toBe(true);
      expect(orgAdminOnlyFields.has("adminDeleteProject")).toBe(true);
      expect(orgAdminOnlyFields.has("adminUpdateClient")).toBe(true);
      expect(orgAdminOnlyFields.has("adminUpdateClientContact")).toBe(true);
      expect(clientScopedAdminFields.has("adminUpdateProject")).toBe(true);
      expect(clientScopedAdminFields.has("adminCreateClientUser")).toBe(true);
    });
  });

  describe("Superadmin Access", () => {
    it("allows superadmin to execute any admin operation without client scope restriction", () => {
      expect(() => authorize("adminClients", {}, superadminContext)).not.toThrow();
      expect(() => authorize("adminCreateProject", { clientId: "client-99" }, superadminContext)).not.toThrow();
      expect(() => authorize("adminUpdateClient", { id: "client-99" }, superadminContext)).not.toThrow();
    });
  });

  describe("Organization Admin Access", () => {
    it("allows Org Admin to access organization settings and project creation within their own client", () => {
      expect(() =>
        authorize("adminUpdateClient", { id: "client-1" }, orgAdminContext)
      ).not.toThrow();

      expect(() =>
        authorize("adminCreateProject", { clientId: "client-1" }, orgAdminContext)
      ).not.toThrow();

      expect(() =>
        authorize("adminDeleteProject", { clientId: "client-1" }, orgAdminContext)
      ).not.toThrow();

      expect(() =>
        authorize("adminUpdateClientContact", { clientId: "client-1" }, orgAdminContext)
      ).not.toThrow();
    });

    it("prevents Org Admin from accessing another organization", () => {
      expect(() =>
        authorize("adminUpdateClient", { id: "client-2" }, orgAdminContext)
      ).toThrow("Cannot access another organisation");

      expect(() =>
        authorize("adminCreateProject", { clientId: "client-2" }, orgAdminContext)
      ).toThrow("Cannot access another organisation");
    });
  });

  describe("Regular Admin Restrictions", () => {
    it("strictly blocks regular Admin from creating projects", () => {
      expect(() =>
        authorize("adminCreateProject", { clientId: "client-1" }, regularAdminContext)
      ).toThrow("Organization Administrator access is required");
    });

    it("strictly blocks regular Admin from deleting projects", () => {
      expect(() =>
        authorize("adminDeleteProject", { clientId: "client-1" }, regularAdminContext)
      ).toThrow("Organization Administrator access is required");
    });

    it("strictly blocks regular Admin from updating organization details or contact email", () => {
      expect(() =>
        authorize("adminUpdateClient", { id: "client-1" }, regularAdminContext)
      ).toThrow("Organization Administrator access is required");

      expect(() =>
        authorize("adminUpdateClientContact", { clientId: "client-1" }, regularAdminContext)
      ).toThrow("Organization Administrator access is required");
    });

    it("allows regular Admin to execute permitted client-scoped operations within their client", () => {
      // Project updating (when authorized to that project)
      expect(() =>
        authorize("adminUpdateProject", { clientId: "client-1" }, regularAdminContext)
      ).not.toThrow();

      // User management operations
      expect(() =>
        authorize("adminCreateClientUser", { clientId: "client-1" }, regularAdminContext)
      ).not.toThrow();

      expect(() =>
        authorize("adminAssignClientUser", { clientId: "client-1" }, regularAdminContext)
      ).not.toThrow();

      expect(() =>
        authorize("adminUpdateClientUser", { clientId: "client-1" }, regularAdminContext)
      ).not.toThrow();

      // Role management
      expect(() =>
        authorize("adminCreateRole", { clientId: "client-1" }, regularAdminContext)
      ).not.toThrow();

      // Connector operations
      expect(() =>
        authorize("adminSaveProjectTicketing", { clientId: "client-1" }, regularAdminContext)
      ).not.toThrow();
    });

    it("prevents regular Admin from accessing another organization", () => {
      expect(() =>
        authorize("adminUpdateProject", { clientId: "client-2" }, regularAdminContext)
      ).toThrow("Cannot access another organisation");
    });

    it("strictly blocks regular Admin from superadmin-only operations (default-deny)", () => {
      expect(() =>
        authorize("adminCreateClient", { name: "New Client" }, regularAdminContext)
      ).toThrow("Superadmin access is required");

      expect(() =>
        authorize("adminDeleteClient", { id: "client-1" }, regularAdminContext)
      ).toThrow("Superadmin access is required");

      expect(() =>
        authorize("adminSetClientStatus", { id: "client-1", status: "blocked" }, regularAdminContext)
      ).toThrow("Superadmin access is required");
    });
  });

  describe("Agent / Non-Admin Access", () => {
    it("denies administrator access to non-admin roles", () => {
      expect(() =>
        authorize("adminProjectsByClient", { clientId: "client-1" }, agentContext)
      ).toThrow("Administrator access is required");

      expect(() =>
        authorize("adminCreateClientUser", { clientId: "client-1" }, agentContext)
      ).toThrow("Administrator access is required");
    });
  });
});
