import { describe, expect, it } from "vitest";
import {
  getAvailableExistingUsers,
  checkUserConflict,
  type AdminUserRow
} from "./user-management";

describe("User Management - Add Existing User Logic", () => {
  const orgUsers: AdminUserRow[] = [
    {
      id: "u-1",
      email: "userA@example.com",
      firstName: "User",
      lastName: "A",
      active: true,
      clientProjects: [
        { projectKey: "project-1", role: "admin" },
        { projectKey: "project-2", role: "customer_service_agent" }
      ]
    },
    {
      id: "u-2",
      email: "userB@example.com",
      firstName: "User",
      lastName: "B",
      active: true,
      clientProjects: [{ projectKey: "project-1", role: "customer_service_agent" }]
    },
    {
      id: "u-3",
      email: "userC@example.com",
      firstName: "User",
      lastName: "C",
      active: true,
      clientProjects: [
        { projectKey: "project-1", role: "admin" },
        { projectKey: "project-2", role: "admin" }
      ]
    }
  ];

  it("calculates available users as Organization Users − Current Project Users for Project 2", () => {
    // Current Project 2 has User A and User C.
    // The Add Existing User list for Project 2 must show ONLY User B.
    const available = getAvailableExistingUsers(orgUsers, "project-2");
    expect(available).toHaveLength(1);
    expect(available[0].email).toBe("userB@example.com");
  });

  it("returns empty list if all organization users already belong to the project", () => {
    // Current Project 1 has User A, User B, and User C.
    // The Add Existing User list for Project 1 must show empty list.
    const available = getAvailableExistingUsers(orgUsers, "project-1");
    expect(available).toHaveLength(0);
  });

  it("works consistently for any project key", () => {
    // Project 3 has no users yet in the organization
    const available = getAvailableExistingUsers(orgUsers, "project-3");
    expect(available).toHaveLength(3);
    expect(available.map((u) => u.email)).toEqual([
      "userA@example.com",
      "userB@example.com",
      "userC@example.com"
    ]);
  });

  it("immediately excludes just-added emails to reflect instantaneous addition", () => {
    const available = getAvailableExistingUsers(orgUsers, "project-2", [
      "userb@example.com"
    ]);
    expect(available).toHaveLength(0);
  });

  it("detects conflict when user already exists in organization but not in current project", () => {
    // User B exists in org, but is NOT in project-2
    const conflict = checkUserConflict(orgUsers, "project-2", "userb@example.com");
    expect(conflict.userInOrg).toBeDefined();
    expect(conflict.userInOrg?.email).toBe("userB@example.com");
    expect(conflict.isMemberOfCurrentProject).toBe(false);
  });

  it("detects when user already exists in organization AND is already member of current project", () => {
    // User A exists in org and IS in project-2
    const conflict = checkUserConflict(orgUsers, "project-2", "userA@example.com");
    expect(conflict.userInOrg).toBeDefined();
    expect(conflict.isMemberOfCurrentProject).toBe(true);
  });

  it("reports no conflict for brand-new users", () => {
    const conflict = checkUserConflict(orgUsers, "project-2", "brandnew@example.com");
    expect(conflict.userInOrg).toBeUndefined();
    expect(conflict.isMemberOfCurrentProject).toBe(false);
  });
});
