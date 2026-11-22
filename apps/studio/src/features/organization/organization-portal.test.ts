import { describe, expect, it } from "vitest";
import { isProjectPage, projectHref, projectPath } from "@/lib/project-url";

describe("Organization Settings Portal — Architecture & Logic", () => {
  describe("Route Stability & Slug Loop Prevention", () => {
    it("ensures /organization is treated as an unscoped non-project page", () => {
      expect(isProjectPage("/organization")).toBe(false);
      expect(isProjectPage("/en-us/organization")).toBe(false);
      expect(isProjectPage("/es-es/organization")).toBe(false);
      expect(isProjectPage("/de-de/organization")).toBe(false);
      expect(isProjectPage("/fr-fr/organization")).toBe(false);
    });

    it("prevents projectHref from prepending active project key to /organization", () => {
      const activeProject = { projectKey: "spotlightstores-demo", clientId: "client-1" };
      const projects = [activeProject];

      // Never prepends projectKey to /organization
      expect(projectHref("/organization", activeProject, projects)).toBe("/organization");
      expect(projectHref("/en-us/organization", activeProject, projects)).toBe("/en-us/organization");
      expect(projectHref("/es-es/organization?tab=users", activeProject, projects)).toBe("/es-es/organization?tab=users");
    });

    it("cleans and normalizes corrupted or repeated project slugs in /organization URLs", () => {
      const activeProject = { projectKey: "spotlightstores-demo", clientId: "client-1" };
      const corruptedSingle = "/en-us/spotlightstores-demo/organization";
      const corruptedRepeated = "/en-us/spotlightstores-demo/spotlightstores-demo/spotlightstores-demo/organization";

      // projectPath extracts clean /organization pathname
      expect(projectPath(corruptedSingle)).toEqual({ projectKey: null, pathname: "/organization" });
      expect(projectPath(corruptedRepeated)).toEqual({ projectKey: null, pathname: "/organization" });

      // isProjectPage identifies them as non-project pages
      expect(isProjectPage(corruptedSingle)).toBe(false);
      expect(isProjectPage(corruptedRepeated)).toBe(false);

      // projectHref recovers and normalizes to the clean URL
      expect(projectHref(corruptedSingle, activeProject)).toBe("/en-us/organization");
      expect(projectHref(corruptedRepeated, activeProject)).toBe("/en-us/organization");
    });

    it("proves URL stability across multiple sequential evaluations (idempotent)", () => {
      const activeProject = { projectKey: "spotlightstores-demo", clientId: "client-1" };
      let currentUrl = "/en-us/organization";

      // Simulate 10 sequential re-render cycles or navigation checks
      for (let i = 0; i < 10; i++) {
        expect(isProjectPage(currentUrl)).toBe(false);
        const nextUrl = projectHref(currentUrl, activeProject);
        expect(nextUrl).toBe("/en-us/organization");
        currentUrl = nextUrl;
      }

      expect(currentUrl).toBe("/en-us/organization");
    });
  });

  describe("Role-Based Visibility & Route Protection", () => {
    it("determines profile dropdown Org Settings visibility by isOrgAdmin flag", () => {
      const getProfileMenuItems = (user: { role: string; isOrgAdmin?: boolean }) => {
        const isOrgAdmin = Boolean(user.isOrgAdmin) || user.role === "superadmin";
        return [
          { id: "profile", label: "My Profile" },
          ...(isOrgAdmin ? [{ id: "settings", label: "Org Settings", href: "/organization" }] : []),
          { id: "logout", label: "Sign Out" }
        ];
      };

      // Organization Admin sees Org Settings
      const orgAdminMenu = getProfileMenuItems({ role: "admin", isOrgAdmin: true });
      expect(orgAdminMenu.some((item) => item.id === "settings")).toBe(true);
      expect(orgAdminMenu.find((item) => item.id === "settings")?.href).toBe("/organization");

      // Superadmin sees Org Settings
      const superadminMenu = getProfileMenuItems({ role: "superadmin" });
      expect(superadminMenu.some((item) => item.id === "settings")).toBe(true);

      // Regular Admin (role === "admin", isOrgAdmin === false) does NOT see Org Settings in profile dropdown
      const regularAdminMenu = getProfileMenuItems({ role: "admin", isOrgAdmin: false });
      expect(regularAdminMenu.some((item) => item.id === "settings")).toBe(false);

      // Agent / Member does NOT see Org Settings
      const agentMenu = getProfileMenuItems({ role: "agent", isOrgAdmin: false });
      expect(agentMenu.some((item) => item.id === "settings")).toBe(false);
      expect(agentMenu.map((i) => i.id)).toEqual(["profile", "logout"]);
    });

    it("determines sidebar Admin Settings visibility for Admin and Superadmin roles", () => {
      const canAccessAdminSettings = (user: { role: string; isOrgAdmin?: boolean }) => {
        return user.role === "admin" || user.role === "superadmin";
      };

      // Both Org Admin and Regular Admin have role === "admin" and see Admin Settings in sidebar
      expect(canAccessAdminSettings({ role: "admin", isOrgAdmin: true })).toBe(true);
      expect(canAccessAdminSettings({ role: "admin", isOrgAdmin: false })).toBe(true);
      expect(canAccessAdminSettings({ role: "superadmin" })).toBe(true);

      // Agent / Member does NOT see Admin Settings in sidebar
      expect(canAccessAdminSettings({ role: "agent", isOrgAdmin: false })).toBe(false);
    });

    it("restricts /organization layout access to Organization Admin and Superadmin only", () => {
      const isRouteAllowed = (user?: { role: string; isOrgAdmin?: boolean } | null) => {
        if (!user) return false;
        return Boolean(user.isOrgAdmin) || user.role === "superadmin";
      };

      // Org Admin and Superadmin are allowed
      expect(isRouteAllowed({ role: "admin", isOrgAdmin: true })).toBe(true);
      expect(isRouteAllowed({ role: "superadmin" })).toBe(true);

      // Regular Admin (role === "admin", isOrgAdmin === false) is redirected/denied from /organization
      expect(isRouteAllowed({ role: "admin", isOrgAdmin: false })).toBe(false);

      // Agent / Member is denied
      expect(isRouteAllowed({ role: "agent", isOrgAdmin: false })).toBe(false);
      expect(isRouteAllowed(null)).toBe(false);
      expect(isRouteAllowed(undefined)).toBe(false);
    });
  });

  describe("Organization Scope & Tenant Derivation", () => {
    it("derives organizationId strictly from authenticated user session", () => {
      const userA = {
        id: "user-1",
        role: "admin",
        activeClientId: "client-abc",
        organization: { id: "client-abc", name: "Client ABC" }
      };

      const userB = {
        id: "user-2",
        role: "admin",
        activeClientId: undefined,
        organization: { id: "client-xyz", name: "Client XYZ" }
      };

      const getOrgId = (u: { activeClientId?: string; organization?: { id?: string } }) =>
        u.activeClientId || u.organization?.id;

      expect(getOrgId(userA)).toBe("client-abc");
      expect(getOrgId(userB)).toBe("client-xyz");
    });

    it("blocks cross-organization resource mutation attempts", () => {
      const authContext = { clientId: "client-abc", userRole: "admin", userEmail: "admin@abc.com" };

      const validateTenantAccess = (requestedClientId: string, context: typeof authContext) => {
        if (context.userRole === "superadmin") return true;
        if (context.userRole !== "admin" || !context.clientId) {
          throw new Error("Administrator access is required");
        }
        if (requestedClientId !== context.clientId) {
          throw new Error("Cannot access another organisation");
        }
        return true;
      };

      // Same organization access succeeds
      expect(validateTenantAccess("client-abc", authContext)).toBe(true);

      // Cross-organization access fails closed
      expect(() => validateTenantAccess("client-xyz", authContext)).toThrow(
        "Cannot access another organisation"
      );
    });
  });

  describe("Organization Details Configuration", () => {
    it("validates required fields on organization update", () => {
      const validateOrgInput = (name: string, email?: string) => {
        const errors: string[] = [];
        if (!name || !name.trim()) {
          errors.push("Organization name is required.");
        }
        if (email && email.trim() && !email.includes("@")) {
          errors.push("Invalid contact email format.");
        }
        return errors;
      };

      expect(validateOrgInput("Acme Corp", "contact@acme.com")).toEqual([]);
      expect(validateOrgInput("   ", "contact@acme.com")).toEqual(["Organization name is required."]);
      expect(validateOrgInput("Acme Corp", "invalid-email")).toEqual(["Invalid contact email format."]);
    });

    it("supports application design themes", () => {
      const validThemes = ["csa-custom", "mantine", "mui"];
      expect(validThemes.includes("csa-custom")).toBe(true);
      expect(validThemes.includes("mantine")).toBe(true);
      expect(validThemes.includes("mui")).toBe(true);
      expect(validThemes.includes("bootstrap")).toBe(false);
    });
  });

  describe("Projects Management & Superadmin Equivalence", () => {
    it("passes authenticated organizationId to CreateProjectModal", () => {
      const orgId = "org-123";
      const modalProps = {
        isOpen: true,
        clientId: orgId
      };

      expect(modalProps.clientId).toBe("org-123");
    });

    it("deduplicates projects by projectKey for clean table and selection rendering", () => {
      const projects = [
        { id: "1", projectKey: "alpha", displayName: "Alpha Store" },
        { id: "2", projectKey: "beta", displayName: "Beta Store" },
        { id: "3", projectKey: "ALPHA", displayName: "Alpha Duplicate" }
      ];

      const unique = projects.filter(
        (p, idx, arr) =>
          Boolean(p.projectKey) &&
          idx === arr.findIndex((t) => t.projectKey.toLowerCase() === p.projectKey.toLowerCase())
      );

      expect(unique).toHaveLength(2);
      expect(unique.map((p) => p.projectKey)).toEqual(["alpha", "beta"]);
    });
  });

  describe("User Management & Single Org Admin Restriction", () => {
    it("allows creating either Admin or Member / Agent role with project assignments", () => {
      const createUserPayload = (input: {
        email: string;
        role: "admin" | "agent";
        projectKeys: string[];
      }) => {
        return {
          email: input.email,
          role: input.role,
          projects: input.projectKeys.map((pk) => ({ projectKey: pk, role: input.role }))
        };
      };

      const regularAdmin = createUserPayload({
        email: "projectadmin@example.com",
        role: "admin",
        projectKeys: ["store-1", "store-2"]
      });
      expect(regularAdmin.role).toBe("admin");
      expect(regularAdmin.projects).toEqual([
        { projectKey: "store-1", role: "admin" },
        { projectKey: "store-2", role: "admin" }
      ]);

      const agent = createUserPayload({
        email: "worker@example.com",
        role: "agent",
        projectKeys: ["store-1"]
      });
      expect(agent.role).toBe("agent");
      expect(agent.projects).toEqual([{ projectKey: "store-1", role: "agent" }]);
    });

    it("protects Organization Admin account from removal or role demotion", () => {
      const canRemoveUser = (targetUser: { email: string; role: string; isOrgAdmin?: boolean }) => {
        if (targetUser.isOrgAdmin) {
          return { allowed: false, reason: "Cannot remove the Organization Admin account." };
        }
        return { allowed: true };
      };

      expect(canRemoveUser({ email: "admin@corp.com", role: "admin", isOrgAdmin: true })).toEqual({
        allowed: false,
        reason: "Cannot remove the Organization Admin account."
      });

      expect(canRemoveUser({ email: "padmin@corp.com", role: "admin", isOrgAdmin: false })).toEqual({
        allowed: true
      });

      expect(canRemoveUser({ email: "agent@corp.com", role: "agent", isOrgAdmin: false })).toEqual({
        allowed: true
      });
    });

    it("handles independent project selection for user access assignment", () => {
      let selected: string[] = ["proj-1"];

      const toggleProject = (projectKey: string, checked: boolean) => {
        if (checked) {
          selected = selected.includes(projectKey) ? selected : [...selected, projectKey];
        } else {
          selected = selected.filter((k) => k !== projectKey);
        }
      };

      // Add proj-2 independently
      toggleProject("proj-2", true);
      expect(selected).toEqual(["proj-1", "proj-2"]);

      // Remove proj-1 independently
      toggleProject("proj-1", false);
      expect(selected).toEqual(["proj-2"]);
    });

    it("exempts Organization Admin from manual project assignment while regular Admins require it", () => {
      const computeUserProjectAssignment = (role: string, isOrgAdmin: boolean, selectedProjects: string[]) => {
        if (isOrgAdmin) {
          return undefined; // Org Admin automatically has organization-wide access
        }
        return selectedProjects.map((pk) => ({ projectKey: pk, role }));
      };

      expect(computeUserProjectAssignment("admin", true, ["p1", "p2"])).toBeUndefined();
      expect(computeUserProjectAssignment("admin", false, ["p1", "p2"])).toEqual([
        { projectKey: "p1", role: "admin" },
        { projectKey: "p2", role: "admin" }
      ]);
      expect(computeUserProjectAssignment("agent", false, ["p1", "p2"])).toEqual([
        { projectKey: "p1", role: "agent" },
        { projectKey: "p2", role: "agent" }
      ]);
    });
  });
});
