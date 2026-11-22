import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import {
  createUser,
  updateClientUser,
  removeUserFromClient,
  countUsersByProjectRole
} from "./repository.js";
import type { CsaUser } from "./types.js";

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  insertOne: vi.fn(),
  countDocuments: vi.fn(),
  createIndex: vi.fn()
}));

vi.mock("../admin/db.js", () => ({ getUsersCollection: async () => db }));

describe("users repository enhancements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateClientUser", () => {
    it("updates role and active status along with projects", async () => {
      const existing: CsaUser = {
        _id: new ObjectId(),
        email: "member@acme.com",
        passwordHash: "hash",
        firstName: "Member",
        lastName: "One",
        role: "agent",
        active: true,
        clientId: "client-1",
        tenantId: "client-1",
        projects: [
          { clientId: "client-1", projectKey: "project-a", role: "agent" },
          { clientId: "client-2", projectKey: "other-proj", role: "agent" }
        ]
      };

      db.findOne
        .mockResolvedValueOnce(existing) // for existing lookup
        .mockResolvedValueOnce({
          ...existing,
          role: "admin",
          active: false,
          projects: [
            { clientId: "client-2", projectKey: "other-proj", role: "agent" },
            { clientId: "client-1", projectKey: "project-b", role: "admin" }
          ]
        }); // for return

      db.updateOne.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const updated = await updateClientUser({
        email: "member@acme.com",
        clientId: "client-1",
        role: "admin",
        active: false,
        projects: [{ projectKey: "project-b", role: "admin" }],
        grantedBy: "superadmin"
      });

      expect(db.updateOne).toHaveBeenCalledWith(
        { email: "member@acme.com" },
        expect.objectContaining({
          $set: expect.objectContaining({
            role: "admin",
            active: false,
            grantedBy: "superadmin"
          })
        })
      );

      const updateCall = db.updateOne.mock.calls[0][1] as any;
      expect(updateCall.$set.projects).toEqual([
        { clientId: "client-2", projectKey: "other-proj", role: "agent" },
        { clientId: "client-1", projectKey: "project-b", role: "admin" }
      ]);
      expect(updated?.role).toBe("admin");
      expect(updated?.active).toBe(false);
    });

    it("allows Organization Admin to have empty client projects slice", async () => {
      const existingOrgAdmin: CsaUser = {
        _id: new ObjectId(),
        email: "admin@acme.com",
        passwordHash: "hash",
        role: "admin",
        active: true,
        clientId: "client-1",
        tenantId: "client-1",
        projects: []
      };

      db.findOne
        .mockResolvedValueOnce(existingOrgAdmin)
        .mockResolvedValueOnce({ ...existingOrgAdmin, firstName: "Updated" });

      db.updateOne.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await updateClientUser({
        email: "admin@acme.com",
        clientId: "client-1",
        firstName: "Updated",
        role: "admin",
        projects: [],
        grantedBy: "superadmin"
      });

      expect(db.updateOne).toHaveBeenCalledWith(
        { email: "admin@acme.com" },
        expect.objectContaining({
          $set: expect.objectContaining({
            firstName: "Updated",
            role: "admin",
            projects: []
          })
        })
      );
    });

    it("rejects promoting another user to Organization Admin when an Org Admin already exists", async () => {
      const existingMember: CsaUser = {
        _id: new ObjectId(),
        email: "member@acme.com",
        passwordHash: "hash",
        role: "agent",
        active: true,
        clientId: "client-1",
        tenantId: "client-1",
        projects: []
      };

      const existingAdminUser: CsaUser = {
        _id: new ObjectId(),
        email: "existing-admin@acme.com",
        passwordHash: "hash",
        role: "admin",
        isOrgAdmin: true,
        active: true,
        clientId: "client-1",
        tenantId: "client-1",
        projects: []
      };

      db.findOne
        .mockResolvedValueOnce(existingMember) // lookup target user
        .mockResolvedValueOnce(existingAdminUser); // check for other admin -> found!

      await expect(
        updateClientUser({
          email: "member@acme.com",
          clientId: "client-1",
          role: "admin",
          isOrgAdmin: true,
          grantedBy: "superadmin"
        })
      ).rejects.toThrow("An Organization Admin already exists for this organization. Cannot promote another user to Organization Admin.");
    });

    it("allows promoting a member to regular Admin even when Org Admin exists", async () => {
      const existingMember: CsaUser = {
        _id: new ObjectId(),
        email: "member@acme.com",
        passwordHash: "hash",
        role: "agent",
        active: true,
        clientId: "client-1",
        tenantId: "client-1",
        projects: [{ clientId: "client-1", projectKey: "proj-1", role: "agent" }]
      };

      db.findOne
        .mockResolvedValueOnce(existingMember)
        .mockResolvedValueOnce({ ...existingMember, role: "admin" });
      db.updateOne.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const updated = await updateClientUser({
        email: "member@acme.com",
        clientId: "client-1",
        role: "admin",
        grantedBy: "superadmin"
      });

      expect(db.updateOne).toHaveBeenCalledWith(
        { email: "member@acme.com" },
        expect.objectContaining({
          $set: expect.objectContaining({
            role: "admin"
          })
        })
      );
      expect(updated?.role).toBe("admin");
    });
  });

  describe("createUser single Org Admin restriction", () => {
    it("rejects creating an additional Organization Admin when one already exists for the client", async () => {
      db.findOne
        .mockResolvedValueOnce(null) // no existing user with this email
        .mockResolvedValueOnce({ _id: new ObjectId(), role: "admin", isOrgAdmin: true, clientId: "client-1" }); // existing admin found

      await expect(
        createUser({
          email: "second-admin@acme.com",
          password: "password123",
          clientId: "client-1",
          role: "admin",
          isOrgAdmin: true,
          grantedBy: "superadmin"
        })
      ).rejects.toThrow("An Organization Admin already exists for this organization. Only one Organization Admin is permitted per organization.");
    });

    it("allows creating initial Organization Admin when none exists for the client", async () => {
      db.findOne
        .mockResolvedValueOnce(null) // no existing user with this email
        .mockResolvedValueOnce(null); // no existing admin for client
      db.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      const created = await createUser({
        email: "initial-admin@acme.com",
        password: "password123",
        clientId: "new-client",
        role: "admin",
        isOrgAdmin: true,
        grantedBy: "superadmin"
      });

      expect(created.email).toBe("initial-admin@acme.com");
      expect(created.role).toBe("admin");
      expect(created.isOrgAdmin).toBe(true);
    });

    it("allows creating regular Admin (role=admin, isOrgAdmin=false) when Org Admin already exists", async () => {
      db.findOne
        .mockResolvedValueOnce(null); // no existing user with this email
      db.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      const created = await createUser({
        email: "regular-admin@acme.com",
        password: "password123",
        clientId: "client-1",
        role: "admin",
        isOrgAdmin: false,
        projects: [{ projectKey: "proj-1", role: "admin" }],
        grantedBy: "superadmin"
      });

      expect(created.email).toBe("regular-admin@acme.com");
      expect(created.role).toBe("admin");
      expect(created.isOrgAdmin).toBe(false);
      expect(created.projects).toEqual([
        { clientId: "client-1", projectKey: "proj-1", role: "admin" }
      ]);
    });
  });

  describe("removeUserFromClient", () => {
    it("safely removes a member user from this client while keeping other client projects", async () => {
      const existingUser: CsaUser = {
        _id: new ObjectId(),
        email: "shared@example.com",
        passwordHash: "hash",
        role: "agent",
        active: true,
        projects: [
          { clientId: "client-1", projectKey: "proj-1", role: "agent" },
          { clientId: "client-2", projectKey: "proj-2", role: "agent" }
        ]
      };

      db.findOne.mockResolvedValueOnce(existingUser);
      db.updateOne.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const ok = await removeUserFromClient("shared@example.com", "client-1");

      expect(ok).toBe(true);
      expect(db.updateOne).toHaveBeenCalledWith(
        { email: "shared@example.com" },
        expect.objectContaining({
          $set: expect.objectContaining({
            projects: [{ clientId: "client-2", projectKey: "proj-2", role: "agent" }]
          })
        })
      );
    });

    it("removes an Organization Admin who has clientId set on user document", async () => {
      const orgAdminUser: CsaUser = {
        _id: new ObjectId(),
        email: "admin@acme.com",
        passwordHash: "hash",
        role: "admin",
        active: true,
        clientId: "client-1",
        tenantId: "client-1",
        projects: []
      };

      db.findOne.mockResolvedValueOnce(orgAdminUser);
      db.updateOne.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const ok = await removeUserFromClient("admin@acme.com", "client-1");

      expect(ok).toBe(true);
      expect(db.updateOne).toHaveBeenCalledWith(
        { email: "admin@acme.com" },
        expect.objectContaining({
          $set: expect.objectContaining({
            projects: [],
            active: false
          })
        })
      );
    });
  });

  describe("countUsersByProjectRole", () => {
    it("includes Org Admins of the client when checking for admin role", async () => {
      db.countDocuments.mockResolvedValueOnce(2);

      const count = await countUsersByProjectRole("client-1", "proj-a", "admin");

      expect(db.countDocuments).toHaveBeenCalledWith({
        active: true,
        $or: [
          { projects: { $elemMatch: { clientId: "client-1", projectKey: "proj-a", role: "admin" } } },
          { role: "admin", clientId: "client-1" },
          { role: "admin", tenantId: "client-1" }
        ]
      });
      expect(count).toBe(2);
    });
  });
});
