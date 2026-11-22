import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectSessionProject, loginWithPassword } from "./auth.js";
import { ObjectId } from "mongodb";

const mockUsers = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  createSession: vi.fn(),
  findActiveSessionByTokenHash: vi.fn(),
  setSessionProject: vi.fn()
}));

const mockMongo = vi.hoisted(() => ({
  findClientById: vi.fn(),
  findClientBySlug: vi.fn(),
  listProjectsByClient: vi.fn()
}));

const mockPasswords = vi.hoisted(() => ({
  verifyPassword: vi.fn()
}));

vi.mock("../users/repository.js", () => mockUsers);
vi.mock("@csa/mongodb", () => mockMongo);
vi.mock("../security/passwords.js", () => mockPasswords);

describe("Organization Admin vs Scoped User Access Control", () => {
  const clientObjectId = new ObjectId();
  const clientId = clientObjectId.toHexString();
  const orgProjects = [
    {
      _id: new ObjectId(),
      clientId,
      projectKey: "acme-us",
      displayName: "Acme US",
      standaloneB2cEnabled: true,
      standaloneB2bEnabled: false
    },
    {
      _id: new ObjectId(),
      clientId,
      projectKey: "acme-eu",
      displayName: "Acme EU",
      standaloneB2cEnabled: false,
      standaloneB2bEnabled: true
    }
  ];

  const clientDoc = {
    _id: clientObjectId,
    name: "Acme Corp",
    slug: "acme-corp",
    uiTheme: "csa-custom"
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMongo.findClientById.mockResolvedValue(clientDoc);
    mockMongo.listProjectsByClient.mockResolvedValue(orgProjects);
    mockPasswords.verifyPassword.mockResolvedValue(true);
  });

  describe("Org Admin access", () => {
    it("dynamically resolves all organization projects for Org Admin", async () => {
      const orgAdminUser = {
        _id: new ObjectId(),
        id: "user-admin-1",
        email: "admin@acme.com",
        passwordHash: "hash",
        role: "admin",
        active: true,
        clientId,
        tenantId: clientId,
        projects: [] // No manual assignments
      };

      mockUsers.findUserByEmail.mockResolvedValue(orgAdminUser);

      const loginRes = await loginWithPassword("admin@acme.com", "password123");

      expect(loginRes).not.toBeNull();
      expect(loginRes?.user.role).toBe("admin");
      expect(loginRes?.user.projects).toHaveLength(2);
      expect(loginRes?.user.projects.map((p) => p.projectKey)).toEqual(["acme-us", "acme-eu"]);
      expect(loginRes?.user.activeProjectKey).toBe("acme-us");
    });

    it("allows Org Admin to switch to any project in their organization", async () => {
      const orgAdminUser = {
        _id: new ObjectId(),
        id: "user-admin-1",
        email: "admin@acme.com",
        role: "admin",
        active: true,
        clientId,
        tenantId: clientId,
        projects: []
      };

      mockUsers.findActiveSessionByTokenHash.mockResolvedValue({
        userId: "user-admin-1",
        activeClientId: clientId,
        activeProjectKey: "acme-us",
        expiresAt: new Date(Date.now() + 3600000)
      });
      mockUsers.findUserById.mockResolvedValue(orgAdminUser);

      const req = { headers: { authorization: "Bearer valid-token" } } as any;

      const result = await selectSessionProject(req, "acme-eu", clientId);

      expect(result).not.toHaveProperty("forbidden");
      expect(mockUsers.setSessionProject).toHaveBeenCalledWith(
        expect.any(String),
        "acme-eu",
        clientId
      );
    });
  });

  describe("Non-Org Admin (Scoped Member) access", () => {
    it("restricts member user strictly to assigned projects", async () => {
      const scopedUser = {
        _id: new ObjectId(),
        id: "user-agent-1",
        email: "agent@acme.com",
        passwordHash: "hash",
        role: "agent",
        active: true,
        clientId,
        tenantId: clientId,
        projects: [
          { clientId, projectKey: "acme-us", role: "agent" }
        ]
      };

      mockUsers.findUserByEmail.mockResolvedValue(scopedUser);

      const loginRes = await loginWithPassword("agent@acme.com", "password123");

      expect(loginRes).not.toBeNull();
      expect(loginRes?.user.role).toBe("agent");
      expect(loginRes?.user.projects).toHaveLength(1);
      expect(loginRes?.user.projects[0].projectKey).toBe("acme-us");
    });

    it("forbids non-Org Admin from selecting an unassigned project", async () => {
      const scopedUser = {
        _id: new ObjectId(),
        id: "user-agent-1",
        email: "agent@acme.com",
        role: "agent",
        active: true,
        clientId,
        tenantId: clientId,
        projects: [
          { clientId, projectKey: "acme-us", role: "agent" } // Only acme-us
        ]
      };

      mockUsers.findActiveSessionByTokenHash.mockResolvedValue({
        userId: "user-agent-1",
        activeClientId: clientId,
        activeProjectKey: "acme-us",
        expiresAt: new Date(Date.now() + 3600000)
      });
      mockUsers.findUserById.mockResolvedValue(scopedUser);

      const req = { headers: { authorization: "Bearer valid-token" } } as any;

      // Attempt to select acme-eu which is NOT in their projects
      const result = await selectSessionProject(req, "acme-eu", clientId);

      expect(result).toEqual({ forbidden: true });
      expect(mockUsers.setSessionProject).not.toHaveBeenCalled();
    });

    it("allows non-Org Admin to select an explicitly assigned project", async () => {
      const scopedUser = {
        _id: new ObjectId(),
        id: "user-agent-1",
        email: "agent@acme.com",
        role: "agent",
        active: true,
        clientId,
        tenantId: clientId,
        projects: [
          { clientId, projectKey: "acme-us", role: "agent" },
          { clientId, projectKey: "acme-eu", role: "agent" }
        ]
      };

      mockUsers.findActiveSessionByTokenHash.mockResolvedValue({
        userId: "user-agent-1",
        activeClientId: clientId,
        activeProjectKey: "acme-us",
        expiresAt: new Date(Date.now() + 3600000)
      });
      mockUsers.findUserById.mockResolvedValue(scopedUser);

      const req = { headers: { authorization: "Bearer valid-token" } } as any;

      const result = await selectSessionProject(req, "acme-eu", clientId);

      expect(result).not.toHaveProperty("forbidden");
      expect(mockUsers.setSessionProject).toHaveBeenCalledWith(
        expect.any(String),
        "acme-eu",
        clientId
      );
    });
  });
});
