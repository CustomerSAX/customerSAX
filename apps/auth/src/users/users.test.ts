import { describe, expect, it } from "vitest";
import { toPublicUser, type AuthUser } from "./types.js";

describe("toPublicUser - Organization Admin & Multi-Project Responsibilities", () => {
  it("allows Organization Admin to exist with zero projects without locking selection", () => {
    const orgAdmin: AuthUser = {
      id: "user-org-admin-1",
      email: "admin@acme.com",
      name: "Acme Admin",
      active: true,
      passwordHash: "hash123",
      role: "admin",
      tenantId: "client-acme-1",
      projects: []
    };

    const publicUser = toPublicUser(orgAdmin);

    expect(publicUser.role).toBe("admin");
    expect(publicUser.projects).toEqual([]);
    expect(publicUser.requiresProjectSelection).toBe(false);
    expect(publicUser.activeClientId).toBe("client-acme-1");
    expect(publicUser.activeProjectKey).toBeUndefined();
  });

  it("handles Organization Admin with a single project by auto-resolving it", () => {
    const orgAdmin: AuthUser = {
      id: "user-org-admin-2",
      email: "admin@acme.com",
      name: "Acme Admin",
      active: true,
      passwordHash: "hash123",
      role: "admin",
      tenantId: "client-acme-1",
      projects: [
        {
          clientId: "client-acme-1",
          projectKey: "acme-main",
          role: "admin"
        }
      ]
    };

    const publicUser = toPublicUser(orgAdmin);

    expect(publicUser.role).toBe("admin");
    expect(publicUser.projects).toHaveLength(1);
    expect(publicUser.requiresProjectSelection).toBe(false);
    expect(publicUser.activeProjectKey).toBe("acme-main");
    expect(publicUser.activeClientId).toBe("client-acme-1");
  });

  it("requires project selection when user has multiple projects and no effective active project", () => {
    const multiProjectAdmin: AuthUser = {
      id: "user-org-admin-3",
      email: "admin@acme.com",
      name: "Acme Admin",
      active: true,
      passwordHash: "hash123",
      role: "admin",
      tenantId: "client-acme-1",
      projects: [
        {
          clientId: "client-acme-1",
          projectKey: "acme-us",
          role: "admin"
        },
        {
          clientId: "client-acme-1",
          projectKey: "acme-eu",
          role: "admin"
        }
      ]
    };

    const publicUser = toPublicUser(multiProjectAdmin);

    expect(publicUser.role).toBe("admin");
    expect(publicUser.projects).toHaveLength(2);
    expect(publicUser.requiresProjectSelection).toBe(true);
  });

  it("never requires project selection for Super Admin", () => {
    const superAdmin: AuthUser = {
      id: "user-superadmin-1",
      email: "superadmin@csa.com",
      name: "Global Superadmin",
      active: true,
      passwordHash: "hash123",
      role: "superadmin",
      tenantId: "csa",
      projects: []
    };

    const publicUser = toPublicUser(superAdmin);

    expect(publicUser.role).toBe("superadmin");
    expect(publicUser.requiresProjectSelection).toBe(false);
  });
});
