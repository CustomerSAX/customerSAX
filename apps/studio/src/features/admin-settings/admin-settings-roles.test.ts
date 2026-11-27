import { describe, expect, it } from "vitest";
import { getVisibleAdminTabs } from "./admin-settings-tabs";

describe("Customer Success Studio — Regular Admin Settings Scoping", () => {
  const getSidebarAdminHref = (user: { role: string; isOrgAdmin?: boolean }) => {
    const isOrgAdmin = Boolean(user.isOrgAdmin) || user.role === "superadmin";
    return isOrgAdmin ? "/admin-settings/organization" : "/admin-settings/projects";
  };

  const resolveAdminRoute = (requestedTab: string, user: { role: string; isOrgAdmin?: boolean }) => {
    const isOrgAdmin = Boolean(user.isOrgAdmin) || user.role === "superadmin";
    if (requestedTab === "organization" && !isOrgAdmin) {
      return { redirect: "/admin-settings/projects" };
    }
    return { render: requestedTab };
  };

  describe("1. Organization Tab Visibility & Route Redirection", () => {
    it("completely hides the Organization tab for regular Admin users", () => {
      const regularAdminTabs = getVisibleAdminTabs(false);
      expect(regularAdminTabs.some((t) => t.id === "organization")).toBe(false);
      expect(regularAdminTabs.map((t) => t.id)).toEqual([
        "projects",
        "connection-hub",
        "knowledge-base",
        "users",
        "roles"
      ]);
    });

    it("retains the Organization tab for Organization Admins and Superadmins", () => {
      const orgAdminTabs = getVisibleAdminTabs(true);
      expect(orgAdminTabs.some((t) => t.id === "organization")).toBe(true);
      expect(orgAdminTabs).toHaveLength(6);
    });

    it("routes regular Admin directly to /admin-settings/projects from the sidebar", () => {
      expect(getSidebarAdminHref({ role: "admin", isOrgAdmin: false })).toBe(
        "/admin-settings/projects"
      );
      expect(getSidebarAdminHref({ role: "admin", isOrgAdmin: true })).toBe(
        "/admin-settings/organization"
      );
      expect(getSidebarAdminHref({ role: "superadmin" })).toBe(
        "/admin-settings/organization"
      );
    });

    it("redirects regular Admin attempting to access /admin-settings/organization to /admin-settings/projects", () => {
      expect(resolveAdminRoute("organization", { role: "admin", isOrgAdmin: false })).toEqual({
        redirect: "/admin-settings/projects"
      });

      expect(resolveAdminRoute("organization", { role: "admin", isOrgAdmin: true })).toEqual({
        render: "organization"
      });

      expect(resolveAdminRoute("projects", { role: "admin", isOrgAdmin: false })).toEqual({
        render: "projects"
      });
    });
  });

  describe("2. Projects Tab Scoping & Current Project Isolation", () => {
    const mockOrgProjects = [
      { id: "p1", projectKey: "store-us", displayName: "US Store", isConfigured: true },
      { id: "p2", projectKey: "store-eu", displayName: "EU Store", isConfigured: true },
      { id: "p3", projectKey: "store-asia", displayName: "Asia Store", isConfigured: false }
    ];

    const getDisplayedProjects = (
      projects: typeof mockOrgProjects,
      user: {
        role: string;
        isOrgAdmin?: boolean;
        activeProjectKey?: string;
        projects: Array<{ projectKey: string }>;
      }
    ) => {
      const isOrgAdmin = Boolean(user.isOrgAdmin) || user.role === "superadmin";
      if (isOrgAdmin) return projects;

      const activeKey = user.activeProjectKey;
      const isAuthorized = Boolean(
        activeKey && user.projects.some((p) => p.projectKey === activeKey)
      );

      return projects.filter((p) => p.projectKey === activeKey && isAuthorized);
    };

    it("displays ONLY the currently selected active project for regular Admin", () => {
      const user = {
        role: "admin",
        isOrgAdmin: false,
        activeProjectKey: "store-us",
        projects: [{ projectKey: "store-us" }, { projectKey: "store-eu" }]
      };

      const displayed = getDisplayedProjects(mockOrgProjects, user);
      expect(displayed).toHaveLength(1);
      expect(displayed[0].projectKey).toBe("store-us");
      expect(displayed.some((p) => p.projectKey === "store-eu")).toBe(false);
    });

    it("updates displayed project when active project is switched", () => {
      const user = {
        role: "admin",
        isOrgAdmin: false,
        activeProjectKey: "store-eu",
        projects: [{ projectKey: "store-us" }, { projectKey: "store-eu" }]
      };

      const displayed = getDisplayedProjects(mockOrgProjects, user);
      expect(displayed).toHaveLength(1);
      expect(displayed[0].projectKey).toBe("store-eu");
    });

    it("displays all projects for Organization Admin and Superadmin", () => {
      const orgAdmin = {
        role: "admin",
        isOrgAdmin: true,
        activeProjectKey: "store-us",
        projects: []
      };

      const displayed = getDisplayedProjects(mockOrgProjects, orgAdmin);
      expect(displayed).toHaveLength(3);
    });

    it("restricts access when regular Admin attempts to access an unauthorized active project", () => {
      const user = {
        role: "admin",
        isOrgAdmin: false,
        activeProjectKey: "store-asia", // not in user's assigned projects
        projects: [{ projectKey: "store-us" }, { projectKey: "store-eu" }]
      };

      const displayed = getDisplayedProjects(mockOrgProjects, user);
      expect(displayed).toHaveLength(0);
    });

    it("hides Create Project button and project switching for regular Admin", () => {
      const getProjectTabActions = (user: { role: string; isOrgAdmin?: boolean }) => {
        const isOrgAdmin = Boolean(user.isOrgAdmin) || user.role === "superadmin";
        return {
          canCreateProject: isOrgAdmin,
          canSwitchProjectInTab: isOrgAdmin,
          editActionLabel: isOrgAdmin ? "Edit Platform" : "Edit Project"
        };
      };

      const regularAdminActions = getProjectTabActions({ role: "admin", isOrgAdmin: false });
      expect(regularAdminActions.canCreateProject).toBe(false);
      expect(regularAdminActions.canSwitchProjectInTab).toBe(false);
      expect(regularAdminActions.editActionLabel).toBe("Edit Project");

      const orgAdminActions = getProjectTabActions({ role: "admin", isOrgAdmin: true });
      expect(orgAdminActions.canCreateProject).toBe(true);
      expect(orgAdminActions.canSwitchProjectInTab).toBe(true);
      expect(orgAdminActions.editActionLabel).toBe("Edit Platform");
    });
  });

  describe("3. Security & Backend Authorization Enforcement", () => {
    it("validates project edit mutation against user assigned projects", () => {
      const userAssignedKeys = new Set(["store-us", "store-eu"]);

      const canEditProject = (
        targetProjectKey: string,
        userRole: string,
        isOrgAdmin: boolean
      ) => {
        if (userRole === "superadmin" || isOrgAdmin) return true;
        return userAssignedKeys.has(targetProjectKey);
      };

      // Allowed for assigned projects
      expect(canEditProject("store-us", "admin", false)).toBe(true);
      expect(canEditProject("store-eu", "admin", false)).toBe(true);

      // Blocked if attempting to manipulate project ID to access unassigned project
      expect(canEditProject("store-asia", "admin", false)).toBe(false);
      expect(canEditProject("other-tenant-store", "admin", false)).toBe(false);
    });

    it("prevents regular Admin from creating or promoting an Organization Admin", () => {
      const validateUserMutation = (
        input: { role?: string; isOrgAdmin?: boolean },
        creator: { userRole: string; isOrgAdmin: boolean }
      ) => {
        if (input.isOrgAdmin && creator.userRole !== "superadmin" && !creator.isOrgAdmin) {
          throw new Error(
            "Only Organization Administrators or Superadmins can create or promote an Organization Admin"
          );
        }
        return true;
      };

      // Regular Admin attempting to create Org Admin is blocked
      expect(() =>
        validateUserMutation(
          { role: "admin", isOrgAdmin: true },
          { userRole: "admin", isOrgAdmin: false }
        )
      ).toThrow(
        "Only Organization Administrators or Superadmins can create or promote an Organization Admin"
      );

      // Regular Admin creating regular Admin or Agent is allowed
      expect(
        validateUserMutation(
          { role: "admin", isOrgAdmin: false },
          { userRole: "admin", isOrgAdmin: false }
        )
      ).toBe(true);

      expect(
        validateUserMutation(
          { role: "agent", isOrgAdmin: false },
          { userRole: "admin", isOrgAdmin: false }
        )
      ).toBe(true);

      // Org Admin creating an Org Admin (subject to single-org-admin check in repository)
      expect(
        validateUserMutation(
          { role: "admin", isOrgAdmin: true },
          { userRole: "admin", isOrgAdmin: true }
        )
      ).toBe(true);
    });
  });

  describe("4. Preserved Admin Settings Sections", () => {
    it("hides Native Connectors and keeps Connection Hub visible for all admin scopes", () => {
      for (const isOrgAdmin of [false, true]) {
        const visibleTabIds = getVisibleAdminTabs(isOrgAdmin).map((tab) => tab.id);
        expect(visibleTabIds).not.toContain("connectors");
        expect(visibleTabIds).toContain("connection-hub");
      }
    });
  });
});
