import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { projectView, projectSecretMasked } from "./repository.js";
import type { CsaProject } from "./types.js";
import { encrypt } from "../encrypt.js";

describe("projectView & projectSecretMasked", () => {
  it("treats projects without credentials as setup_required and returns empty masked secret", () => {
    const unconfiguredProject: CsaProject = {
      _id: new ObjectId(),
      clientId: "client-123",
      projectKey: "acme-initial",
      displayName: "Acme Initial Project",
      platform: "commercetools",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "superadmin",
      isConfigured: false,
      status: "setup_required"
    };

    const view = projectView(unconfiguredProject);

    expect(view.isConfigured).toBe(false);
    expect(view.status).toBe("setup_required");
    expect(view.ctClientSecretMasked).toBe("");
    expect(projectSecretMasked(unconfiguredProject)).toBe("");
  });

  it("treats projects with full credentials as active and configured, masking secrets without revealing plaintext", () => {
    const rawSecret = "super-secret-token-12345";
    const encryptedSecret = encrypt(rawSecret);

    const configuredProject: CsaProject = {
      _id: new ObjectId(),
      clientId: "client-123",
      projectKey: "acme-configured",
      displayName: "Acme Active Project",
      platform: "commercetools",
      ctApiUrl: "https://api.us-central1.gcp.commercetools.com",
      ctAuthUrl: "https://auth.us-central1.gcp.commercetools.com",
      ctClientId: "ct-client-id-abc",
      ctClientSecretEncrypted: encryptedSecret,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "admin",
      isConfigured: true,
      status: "active"
    };

    const view = projectView(configuredProject);

    expect(view.isConfigured).toBe(true);
    expect(view.status).toBe("active");
    expect(view.ctClientSecretMasked).not.toBe("");
    expect(view.ctClientSecretMasked).toContain("••••");
    // Guarantee secret is never returned in plaintext
    expect(view.ctClientSecretMasked).not.toBe(rawSecret);
    expect(JSON.stringify(view)).not.toContain(rawSecret);
  });
});
