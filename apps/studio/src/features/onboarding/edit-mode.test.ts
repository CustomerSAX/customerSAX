import { describe, expect, it } from "vitest";
import { STEPS } from "./constants";
import { mapClientToOnboardingState } from "./mapping";
import type { ProjectDraft } from "./types";

describe("Organization Edit Journey & Parity with Onboarding", () => {
  it("uses the identical 6-step journey for both creation and editing", () => {
    expect(STEPS).toHaveLength(6);
    expect(STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(STEPS.map((s) => s.navLabel)).toEqual([
      "Organization",
      "Appearance",
      "Projects",
      "Connectors",
      "Team & Access",
      "Review & Launch"
    ]);
  });

  describe("mapClientToOnboardingState", () => {
    const mockClientData = {
      adminClient: {
        id: "client_123",
        name: "Acme Global Retail",
        slug: "acme-global",
        contactEmail: "admin@acmeglobal.com",
        uiTheme: "sunrise",
        ssoConfig: {
          provider: "oidc",
          issuer: "https://auth.acmeglobal.com",
          clientId: "sso_client_99",
          providerDisplayName: "Acme Okta SSO"
        }
      },
      adminProjectsByClient: [
        {
          id: "proj_ct_1",
          projectKey: "acme-us",
          displayName: "Acme US Store",
          platform: "commercetools",
          standaloneB2bEnabled: false,
          ctApiUrl: "https://api.us-central1.gcp.commercetools.com",
          ctAuthUrl: "https://auth.us-central1.gcp.commercetools.com",
          ctClientId: "ct_client_id_abc",
          ctClientSecretMasked: "••••••••••••",
          scopes: "manage_project:acme-us",
          ticketingProvider: "zendesk"
        },
        {
          id: "proj_shopify_2",
          projectKey: "acme-eu",
          displayName: "Acme EU Store",
          platform: "shopify",
          standaloneB2bEnabled: true,
          shopifyStoreDomain: "acme-eu.myshopify.com",
          shopifyApiVersion: "2024-01"
        }
      ],
      adminUsersByClient: [
        {
          id: "user_1",
          email: "sarah@acmeglobal.com",
          firstName: "Sarah",
          lastName: "Connor",
          role: "admin",
          clientProjects: [{ projectKey: "acme-us" }]
        }
      ],
      adminSmtpProfilesByClient: [
        {
          id: "smtp_1",
          name: "SendGrid Corporate",
          smtpHost: "smtp.sendgrid.net",
          smtpPort: 587,
          smtpSecure: true,
          smtpUser: "apikey",
          emailFrom: "support@acmeglobal.com",
          isDefault: true
        }
      ],
      adminAiSettings: {
        enabled: true,
        provider: "openai",
        displayName: "Acme AI Assistant",
        model: "gpt-4o",
        baseUrl: "https://api.openai.com/v1"
      }
    };

    const mockTicketingData = {
      adminProjectTicketing: {
        provider: "zendesk",
        subdomain: "acmesupport",
        clientId: "zendesk_client_1"
      }
    };

    it("pre-populates all organization details correctly from GraphQL query data", () => {
      const { state, originalProjectIds, originalSmtpProfileId } = mapClientToOnboardingState(
        mockClientData,
        mockTicketingData,
        "client_123"
      );

      // Organization info
      expect(state.name).toBe("Acme Global Retail");
      expect(state.slug).toBe("acme-global");
      expect(state.contactEmail).toBe("admin@acmeglobal.com");
      expect(state.uiTheme).toBe("sunrise");

      // Tracked IDs for edit mutations
      expect(originalProjectIds).toEqual(["proj_ct_1", "proj_shopify_2"]);
      expect(originalSmtpProfileId).toBe("smtp_1");

      // Projects
      expect(state.projects).toHaveLength(2);
      const [proj1, proj2] = state.projects;

      expect(proj1.id).toBe("proj_ct_1");
      expect(proj1.projectKey).toBe("acme-us");
      expect(proj1.platform).toBe("commercetools");
      expect(proj1.isExisting).toBe(true);
      expect(proj1.ctClientId).toBe("ct_client_id_abc");
      expect(proj1.ctClientSecret).toBe(""); // Not re-exposed as plaintext
      expect(proj1.ctClientSecretMasked).toBe("••••••••••••");
      expect(proj1.testedOk).toBe(true);

      expect(proj2.id).toBe("proj_shopify_2");
      expect(proj2.projectKey).toBe("acme-eu");
      expect(proj2.platform).toBe("shopify");
      expect(proj2.shellMode).toBe("b2b");
      expect(proj2.isExisting).toBe(true);
      expect(proj2.shopifyStoreDomain).toBe("acme-eu.myshopify.com");

      // Connectors: Ticketing
      expect(state.ticketing.provider).toBe("zendesk");
      expect(state.ticketing.subdomain).toBe("acmesupport");
      expect(state.ticketing.clientId).toBe("zendesk_client_1");

      // Connectors: AI Settings
      expect(state.aiSettings.enabled).toBe(true);
      expect(state.aiSettings.displayName).toBe("Acme AI Assistant");
      expect(state.aiSettings.model).toBe("gpt-4o");

      // Connectors: SMTP
      expect(state.smtpProfile.enabled).toBe(true);
      expect(state.smtpProfile.smtpHost).toBe("smtp.sendgrid.net");
      expect(state.smtpProfile.emailFrom).toBe("support@acmeglobal.com");

      // Connectors: SSO
      expect(state.ssoConfig.provider).toBe("oidc");
      expect(state.ssoConfig.issuer).toBe("https://auth.acmeglobal.com");
      expect(state.ssoConfig.clientId).toBe("sso_client_99");

      // Team Members
      expect(state.teamMembers).toHaveLength(1);
      expect(state.teamMembers[0].email).toBe("sarah@acmeglobal.com");
      expect(state.teamMembers[0].role).toBe("admin");
      expect(state.teamMembers[0].isExisting).toBe(true);
      expect(state.teamMembers[0].projectKeys).toEqual(["acme-us"]);
    });

    it("handles legacy/empty organizations with clean defaults", () => {
      const minimalClientData = {
        adminClient: {
          id: "client_empty",
          name: "Minimal Org",
          slug: "minimal-org",
          contactEmail: "minimal@csa.local"
        },
        adminProjectsByClient: [],
        adminUsersByClient: [],
        adminSmtpProfilesByClient: [],
        adminAiSettings: null
      };

      const { state, originalProjectIds, originalSmtpProfileId } = mapClientToOnboardingState(
        minimalClientData,
        null,
        "client_empty"
      );

      expect(state.name).toBe("Minimal Org");
      expect(state.uiTheme).toBe("csa-custom");
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].isExisting).toBeFalsy();
      expect(originalProjectIds).toEqual([]);
      expect(originalSmtpProfileId).toBeUndefined();
      expect(state.ssoConfig.provider).toBe("none");
      expect(state.aiSettings.enabled).toBe(false);
      expect(state.teamMembers).toEqual([]);
    });
  });

  describe("Validation logic for Create vs Edit mode", () => {
    function validateProjects(projects: ProjectDraft[]): string[] {
      const errors: string[] = [];
      const validProjects = projects.filter((p) => Boolean(p.projectKey.trim()));
      if (validProjects.length === 0) {
        errors.push("At least one project with a valid Project Key is required.");
      }

      for (const proj of validProjects) {
        if (proj.isExisting) {
          // Existing project credentials are confirmed and stored securely
          continue;
        }
        if (proj.platform === "commercetools" && (!proj.ctClientId?.trim() || !proj.ctClientSecret?.trim())) {
          errors.push(`Project ${proj.projectKey}: Commercetools Client ID and Secret are required.`);
        } else if (proj.platform === "shopify" && (!proj.shopifyStoreDomain?.trim() || !proj.shopifyAdminAccessToken?.trim())) {
          errors.push(`Project ${proj.projectKey}: Shopify Store Domain and Admin Access Token are required.`);
        }
      }
      return errors;
    }

    it("requires secret credentials for new projects in CREATE mode", () => {
      const newProjects: ProjectDraft[] = [
        {
          id: "new_1",
          projectKey: "new-store",
          displayName: "New Store",
          platform: "commercetools",
          shellMode: "b2c",
          ctClientId: "client_id_only",
          ctClientSecret: "",
          isExisting: false
        }
      ];

      const errors = validateProjects(newProjects);
      expect(errors).toContain("Project new-store: Commercetools Client ID and Secret are required.");
    });

    it("allows omitting secrets for existing projects in EDIT mode", () => {
      const existingProjects: ProjectDraft[] = [
        {
          id: "proj_1",
          projectKey: "existing-store",
          displayName: "Existing Store",
          platform: "commercetools",
          shellMode: "b2c",
          ctClientId: "client_id_val",
          ctClientSecret: "", // Blank because user didn't change it
          isExisting: true
        }
      ];

      const errors = validateProjects(existingProjects);
      expect(errors).toHaveLength(0);
    });
  });
});
