"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { Badge, Button, Card, Icon, LoadingSpinner, Modal, ModalBody, ModalFooter, ModalHeader } from "@csa/ui";
import {
  ADMIN_ASSIGN_CLIENT_USER,
  ADMIN_CREATE_CLIENT,
  ADMIN_CREATE_CLIENT_USER,
  ADMIN_CREATE_PROJECT,
  ADMIN_CREATE_SMTP_PROFILE,
  ADMIN_DELETE_PROJECT,
  ADMIN_SAVE_PROJECT_TICKETING,
  ADMIN_UPDATE_AI_SETTINGS,
  ADMIN_UPDATE_CLIENT,
  ADMIN_UPDATE_PROJECT,
  ADMIN_UPDATE_SMTP_PROFILE
} from "@/features/superadmin/api/queries";
import { useCurrentUser } from "@/lib/use-current-user";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import { ONBOARDING_DRAFT_STORAGE_KEY, UI_THEME_OPTIONS } from "../constants";
import type { OnboardingState, StepId } from "../types";

interface Step6ReviewLaunchProps {
  state: OnboardingState;
  onGoToStep: (stepId: StepId) => void;
  mode?: "create" | "edit";
  organizationId?: string;
  originalProjectIds?: string[];
  originalSmtpProfileId?: string;
  onSuccess?: () => void;
}

export function Step6ReviewLaunch({
  state,
  onGoToStep,
  mode = "create",
  organizationId,
  originalProjectIds,
  originalSmtpProfileId,
  onSuccess
}: Step6ReviewLaunchProps) {
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  const isEdit = mode === "edit" || Boolean(organizationId);

  const [createClient] = useMutation(ADMIN_CREATE_CLIENT);
  const [updateClient] = useMutation(ADMIN_UPDATE_CLIENT);
  const [createProject] = useMutation(ADMIN_CREATE_PROJECT);
  const [updateProject] = useMutation(ADMIN_UPDATE_PROJECT);
  const [deleteProject] = useMutation(ADMIN_DELETE_PROJECT);
  const [saveProjectTicketing] = useMutation(ADMIN_SAVE_PROJECT_TICKETING);
  const [updateAiSettings] = useMutation(ADMIN_UPDATE_AI_SETTINGS);
  const [createSmtpProfile] = useMutation(ADMIN_CREATE_SMTP_PROFILE);
  const [updateSmtpProfile] = useMutation(ADMIN_UPDATE_SMTP_PROFILE);
  const [createClientUser] = useMutation(ADMIN_CREATE_CLIENT_USER);
  const [assignClientUser] = useMutation(ADMIN_ASSIGN_CLIENT_USER);

  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStepMessage, setLaunchStepMessage] = useState("");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(organizationId || null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  // Validation Checks
  const validationErrors: Array<{ stepId: StepId; label: string; issue: string }> = [];

  if (!state.name.trim()) {
    validationErrors.push({ stepId: 1, label: "Organization Details", issue: "Organization Name is required." });
  }
  if (!state.slug.trim()) {
    validationErrors.push({ stepId: 1, label: "Organization Details", issue: "Organization Slug is required." });
  }
  if (!state.contactEmail.trim()) {
    validationErrors.push({ stepId: 1, label: "Organization Details", issue: "Administrative Contact Email is required." });
  }

  const validProjects = state.projects.filter((p) => Boolean(p.projectKey.trim()));
  if (validProjects.length === 0) {
    validationErrors.push({ stepId: 3, label: "Projects & Commerce", issue: "At least one project with a valid Project Key is required." });
  }

  for (const proj of validProjects) {
    if (proj.isExisting) {
      // Existing project credentials are already verified and stored securely in backend
      continue;
    }
    if (proj.platform === "commercetools" && (!proj.ctClientId?.trim() || !proj.ctClientSecret?.trim())) {
      validationErrors.push({
        stepId: 3,
        label: `Project: ${proj.displayName || proj.projectKey}`,
        issue: "Commercetools Client ID and Secret are required."
      });
    } else if (proj.platform === "shopify" && (!proj.shopifyStoreDomain?.trim() || !proj.shopifyAdminAccessToken?.trim())) {
      validationErrors.push({
        stepId: 3,
        label: `Project: ${proj.displayName || proj.projectKey}`,
        issue: "Shopify Store Domain and Admin Access Token are required."
      });
    } else if (proj.platform === "bigcommerce" && (!proj.bigcommerceStoreHash?.trim() || !proj.bigcommerceAccessToken?.trim())) {
      validationErrors.push({
        stepId: 3,
        label: `Project: ${proj.displayName || proj.projectKey}`,
        issue: "BigCommerce Store Hash and Access Token are required."
      });
    }
  }

  const canLaunch = validationErrors.length === 0 && !isLaunching;

  const handleLaunch = async () => {
    if (!canLaunch) return;

    setIsLaunching(true);
    setLaunchError(null);
    const authorEmail = currentUser?.email || "superadmin@csa.local";

    try {
      if (isEdit && organizationId) {
        // --- 1. EDIT MODE: Update Organization Tenant ---
        setLaunchStepMessage("Step 1/5: Updating Organization Details...");
        await updateClient({
          variables: {
            id: organizationId,
            name: state.name.trim(),
            contactEmail: state.contactEmail.trim(),
            uiTheme: state.uiTheme || "csa-custom",
            ssoConfig:
              state.ssoConfig && state.ssoConfig.provider && state.ssoConfig.provider !== "none"
                ? {
                    provider: state.ssoConfig.provider,
                    issuer: state.ssoConfig.issuer || undefined,
                    clientId: state.ssoConfig.clientId || undefined,
                    clientSecret: state.ssoConfig.clientSecret || undefined,
                    providerDisplayName: state.ssoConfig.providerDisplayName || undefined,
                    entryPointUrl: state.ssoConfig.entryPointUrl || undefined,
                    idpCertPem: state.ssoConfig.idpCertPem || undefined
                  }
                : undefined
          }
        });

        // Cache theme locally for instant preview sync
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(localStorage.getItem("csa_org_themes") || "{}");
            stored[organizationId] = state.uiTheme;
            if (state.slug.trim()) stored[state.slug.trim()] = state.uiTheme;
            stored[state.name.trim()] = state.uiTheme;
            localStorage.setItem("csa_org_themes", JSON.stringify(stored));
            localStorage.removeItem("csa_dev_ui_override");
            localStorage.removeItem("csa_ui_library");
          } catch {
            // ignore storage error
          }
        }

        // --- 2. EDIT MODE: Update or Create Projects ---
        const retainedProjectIds = new Set<string>();
        const projectMap: Record<string, string> = {};

        for (let i = 0; i < validProjects.length; i++) {
          const proj = validProjects[i];
          setLaunchStepMessage(`Step 2/5: Synchronizing project ${i + 1} of ${validProjects.length} (${proj.displayName})...`);

          const shellFlags = {
            standaloneB2cEnabled: proj.shellMode === "b2c",
            standaloneB2bEnabled: proj.shellMode === "b2b"
          };
          const cleanScope = (proj.scopes?.trim() && proj.scopes.trim() !== "manage_project:") ? proj.scopes.trim() : undefined;

          if (proj.isExisting && proj.id && !proj.id.startsWith("proj_")) {
            retainedProjectIds.add(proj.id);
            projectMap[proj.projectKey.trim()] = proj.id;

            const updatePayload: Record<string, unknown> = {
              displayName: proj.displayName.trim() || proj.projectKey.trim(),
              ...shellFlags
            };

            if (proj.platform === "commercetools") {
              updatePayload.ctApiUrl = proj.ctApiUrl?.trim();
              updatePayload.ctAuthUrl = proj.ctAuthUrl?.trim();
              updatePayload.ctClientId = proj.ctClientId?.trim();
              if (proj.ctClientSecret?.trim()) updatePayload.ctClientSecret = proj.ctClientSecret.trim();
              updatePayload.scopes = cleanScope;
            } else if (proj.platform === "shopify") {
              updatePayload.shopifyStoreDomain = proj.shopifyStoreDomain?.trim();
              if (proj.shopifyAdminAccessToken?.trim()) updatePayload.shopifyAdminAccessToken = proj.shopifyAdminAccessToken.trim();
              updatePayload.shopifyApiVersion = proj.shopifyApiVersion || "2024-01";
            } else if (proj.platform === "bigcommerce") {
              updatePayload.bigcommerceStoreHash = proj.bigcommerceStoreHash?.trim();
              updatePayload.bigcommerceClientId = proj.bigcommerceClientId?.trim();
              if (proj.bigcommerceAccessToken?.trim()) updatePayload.bigcommerceAccessToken = proj.bigcommerceAccessToken.trim();
            }

            await updateProject({
              variables: {
                id: proj.id,
                input: updatePayload
              }
            });
          } else {
            const inputPayload =
              proj.platform === "shopify"
                ? {
                    platform: "shopify",
                    projectKey: proj.projectKey.trim(),
                    displayName: proj.displayName.trim() || proj.projectKey.trim(),
                    shopifyStoreDomain: proj.shopifyStoreDomain?.trim(),
                    shopifyAdminAccessToken: proj.shopifyAdminAccessToken?.trim(),
                    shopifyApiVersion: proj.shopifyApiVersion || "2024-01",
                    ...shellFlags
                  }
                : proj.platform === "bigcommerce"
                  ? {
                      platform: "bigcommerce",
                      projectKey: proj.projectKey.trim(),
                      displayName: proj.displayName.trim() || proj.projectKey.trim(),
                      bigcommerceStoreHash: proj.bigcommerceStoreHash?.trim(),
                      bigcommerceClientId: proj.bigcommerceClientId?.trim(),
                      bigcommerceAccessToken: proj.bigcommerceAccessToken?.trim(),
                      ...shellFlags
                    }
                  : {
                      platform: "commercetools",
                      projectKey: proj.projectKey.trim(),
                      displayName: proj.displayName.trim() || proj.projectKey.trim(),
                      ctApiUrl: proj.ctApiUrl?.trim(),
                      ctAuthUrl: proj.ctAuthUrl?.trim(),
                      ctClientId: proj.ctClientId?.trim(),
                      ctClientSecret: proj.ctClientSecret?.trim(),
                      scopes: cleanScope,
                      ...shellFlags
                    };

            const projRes = await createProject({
              variables: {
                clientId: organizationId,
                input: inputPayload,
                createdBy: authorEmail
              }
            });

            const createdProjId = projRes.data?.adminCreateProject?.id;
            if (createdProjId) {
              retainedProjectIds.add(createdProjId);
              projectMap[proj.projectKey.trim()] = createdProjId;
            }
          }

          // 3. Configure Ticketing
          const targetProjId = projectMap[proj.projectKey.trim()] || proj.id;
          if (targetProjId && state.ticketing.provider) {
            try {
              await saveProjectTicketing({
                variables: {
                  clientId: organizationId,
                  id: targetProjId,
                  input: {
                    provider: state.ticketing.provider,
                    subdomain: state.ticketing.subdomain || undefined,
                    clientId: state.ticketing.clientId || undefined,
                    clientSecret: state.ticketing.clientSecret || undefined,
                    freshdeskDomain: state.ticketing.freshdeskDomain || undefined,
                    freshdeskApiKey: state.ticketing.freshdeskApiKey || undefined
                  }
                }
              });
            } catch (err) {
              console.warn("Failed to set ticketing provider:", err);
            }
          }
        }

        // Delete any projects that were removed in edit mode
        if (originalProjectIds && originalProjectIds.length > 0) {
          for (const oldId of originalProjectIds) {
            if (!retainedProjectIds.has(oldId)) {
              try {
                await deleteProject({ variables: { id: oldId } });
              } catch (delErr) {
                console.warn(`Failed to delete removed project ${oldId}:`, delErr);
              }
            }
          }
        }

        // --- 4. EDIT MODE: Update AI Settings & SMTP ---
        setLaunchStepMessage("Step 4/5: Updating AI Assistant & Service Settings...");
        try {
          await updateAiSettings({
            variables: {
              clientId: organizationId,
              input: {
                enabled: state.aiSettings.enabled,
                provider: state.aiSettings.provider || "openai",
                displayName: state.aiSettings.displayName || "CSA Assistant",
                model: state.aiSettings.model || "gpt-4o-mini",
                baseUrl: state.aiSettings.baseUrl || undefined,
                apiKey: state.aiSettings.apiKey?.trim() || undefined
              }
            }
          });
        } catch (err) {
          console.warn("Failed to update AI settings:", err);
        }

        if (state.smtpProfile.enabled && state.smtpProfile.smtpHost?.trim()) {
          try {
            if (originalSmtpProfileId) {
              await updateSmtpProfile({
                variables: {
                  id: originalSmtpProfileId,
                  clientId: organizationId,
                  input: {
                    name: state.smtpProfile.name || "Default SMTP",
                    smtpHost: state.smtpProfile.smtpHost.trim(),
                    smtpPort: state.smtpProfile.smtpPort || 587,
                    smtpSecure: state.smtpProfile.smtpSecure,
                    smtpUser: state.smtpProfile.smtpUser?.trim() || undefined,
                    smtpPassword: state.smtpProfile.smtpPassword?.trim() || undefined,
                    emailFrom: state.smtpProfile.emailFrom?.trim() || "support@csa.local",
                    isDefault: true
                  }
                }
              });
            } else {
              await createSmtpProfile({
                variables: {
                  clientId: organizationId,
                  input: {
                    name: state.smtpProfile.name || "Default SMTP",
                    smtpHost: state.smtpProfile.smtpHost.trim(),
                    smtpPort: state.smtpProfile.smtpPort || 587,
                    smtpSecure: state.smtpProfile.smtpSecure,
                    smtpUser: state.smtpProfile.smtpUser?.trim() || undefined,
                    smtpPassword: state.smtpProfile.smtpPassword?.trim() || undefined,
                    emailFrom: state.smtpProfile.emailFrom?.trim() || "support@csa.local",
                    isDefault: true
                  }
                }
              });
            }
          } catch (err) {
            console.warn("Failed to save SMTP profile:", err);
          }
        }

        // --- 5. EDIT MODE: Provision New Team Members ---
        const draftMember = state.draftUser;
        const newMembersToProvision = state.teamMembers.filter((m) => !m.isExisting);
        if (
          draftMember?.email?.trim() &&
          !newMembersToProvision.some((m) => m.email.toLowerCase() === draftMember.email!.trim().toLowerCase()) &&
          !state.teamMembers.some((m) => m.email.toLowerCase() === draftMember.email!.trim().toLowerCase())
        ) {
          newMembersToProvision.push({
            id: `user_draft_${Date.now()}`,
            mode: draftMember.mode || "assign",
            email: draftMember.email.trim().toLowerCase(),
            firstName: draftMember.firstName?.trim() || undefined,
            lastName: draftMember.lastName?.trim() || undefined,
            password: draftMember.password || undefined,
            role: draftMember.role || "admin",
            projectKeys: draftMember.projectKeys || validProjects.map((p) => p.projectKey)
          });
        }

        if (newMembersToProvision.length > 0) {
          setLaunchStepMessage("Step 5/5: Provisioning Team Access...");
          for (const member of newMembersToProvision) {
            const validKeys = member.projectKeys.filter(
              (k) => projectMap[k] || validProjects.some((p) => p.projectKey === k)
            );
            const keysToUse = validKeys.length > 0 ? validKeys : validProjects.map((p) => p.projectKey);
            const userProjects = keysToUse.map((k) => ({
              projectKey: k,
              role: member.role
            }));
            const memberEmail = member.email.trim().toLowerCase();

            try {
              if (member.mode === "create" && member.password) {
                try {
                  await createClientUser({
                    variables: {
                      clientId: organizationId,
                      grantedBy: authorEmail,
                      input: {
                        email: memberEmail,
                        password: member.password,
                        firstName: member.firstName?.trim() || undefined,
                        lastName: member.lastName?.trim() || undefined,
                        projects: userProjects
                      }
                    }
                  });
                } catch (createErr: unknown) {
                  const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
                  if (errMsg.toLowerCase().includes("already exists") || errMsg.toLowerCase().includes("duplicate")) {
                    await assignClientUser({
                      variables: {
                        clientId: organizationId,
                        grantedBy: authorEmail,
                        input: {
                          email: memberEmail,
                          projects: userProjects
                        }
                      }
                    });
                  } else {
                    throw createErr;
                  }
                }
              } else {
                try {
                  await assignClientUser({
                    variables: {
                      clientId: organizationId,
                      grantedBy: authorEmail,
                      input: {
                        email: memberEmail,
                        projects: userProjects
                      }
                    }
                  });
                } catch (assignErr: unknown) {
                  const errMsg = assignErr instanceof Error ? assignErr.message : String(assignErr);
                  if (member.password && (errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("does not exist"))) {
                    await createClientUser({
                      variables: {
                        clientId: organizationId,
                        grantedBy: authorEmail,
                        input: {
                          email: memberEmail,
                          password: member.password,
                          firstName: member.firstName?.trim() || undefined,
                          lastName: member.lastName?.trim() || undefined,
                          projects: userProjects
                        }
                      }
                    });
                  } else {
                    throw assignErr;
                  }
                }
              }
            } catch (err) {
              console.error(`Could not provision team member ${member.email}:`, err);
            }
          }
        }

        // Persist search settings in localStorage for this organization
        if (typeof window !== "undefined" && state.search) {
          try {
            localStorage.setItem(`csa_org_search_${organizationId}`, JSON.stringify(state.search));
          } catch {
            // ignore
          }
        }

        setCreatedClientId(organizationId);
        setIsSuccessOpen(true);
        if (onSuccess) onSuccess();
      } else {
        // --- CREATE MODE WORKFLOW ---
        // 1. Create Organization Client
        setLaunchStepMessage("Step 1/5: Provisioning Organization Tenant...");
        const clientRes = await createClient({
          variables: {
            name: state.name.trim(),
            slug: state.slug.trim(),
            contactEmail: state.contactEmail.trim(),
            uiTheme: state.uiTheme || "csa-custom"
          }
        });
        const newClientId = clientRes.data?.adminCreateClient?.id;
        if (!newClientId) throw new Error("Failed to provision organization tenant.");

        // Cache theme locally for instant preview sync
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(localStorage.getItem("csa_org_themes") || "{}");
            stored[newClientId] = state.uiTheme;
            stored[state.slug.trim()] = state.uiTheme;
            localStorage.setItem("csa_org_themes", JSON.stringify(stored));
          } catch {
            // ignore storage error
          }
        }

      // 2. Provision Projects
      const createdProjectMap: Record<string, string> = {}; // key -> id
      for (let i = 0; i < validProjects.length; i++) {
        const proj = validProjects[i];
        setLaunchStepMessage(`Step 2/5: Connecting project ${i + 1} of ${validProjects.length} (${proj.displayName})...`);

        const shellFlags = {
          standaloneB2cEnabled: proj.shellMode === "b2c",
          standaloneB2bEnabled: proj.shellMode === "b2b"
        };

        const inputPayload =
          proj.platform === "shopify"
            ? {
                platform: "shopify",
                projectKey: proj.projectKey.trim(),
                displayName: proj.displayName.trim() || proj.projectKey.trim(),
                shopifyStoreDomain: proj.shopifyStoreDomain?.trim(),
                shopifyAdminAccessToken: proj.shopifyAdminAccessToken?.trim(),
                shopifyApiVersion: proj.shopifyApiVersion || "2024-01",
                ...shellFlags
              }
            : proj.platform === "bigcommerce"
              ? {
                  platform: "bigcommerce",
                  projectKey: proj.projectKey.trim(),
                  displayName: proj.displayName.trim() || proj.projectKey.trim(),
                  bigcommerceStoreHash: proj.bigcommerceStoreHash?.trim(),
                  bigcommerceClientId: proj.bigcommerceClientId?.trim(),
                  bigcommerceAccessToken: proj.bigcommerceAccessToken?.trim(),
                  ...shellFlags
                }
              : {
                  platform: "commercetools",
                  projectKey: proj.projectKey.trim(),
                  displayName: proj.displayName.trim() || proj.projectKey.trim(),
                  ctApiUrl: proj.ctApiUrl?.trim(),
                  ctAuthUrl: proj.ctAuthUrl?.trim(),
                  ctClientId: proj.ctClientId?.trim(),
                  ctClientSecret: proj.ctClientSecret?.trim(),
                  scopes: (proj.scopes?.trim() && proj.scopes.trim() !== "manage_project:") ? proj.scopes.trim() : undefined,
                  ...shellFlags
                };

        const projRes = await createProject({
          variables: {
            clientId: newClientId,
            input: inputPayload,
            createdBy: authorEmail
          }
        });

        const createdProjId = projRes.data?.adminCreateProject?.id;
        if (createdProjId) {
          createdProjectMap[proj.projectKey.trim()] = createdProjId;

          // 3. Configure Ticketing on this project (if non-native or explicitly set)
          if (state.ticketing.provider && state.ticketing.provider !== "internal") {
            setLaunchStepMessage(`Step 3/5: Setting up ${state.ticketing.provider} ticketing connector...`);
            try {
              await saveProjectTicketing({
                variables: {
                  clientId: newClientId,
                  id: createdProjId,
                  input: {
                    provider: state.ticketing.provider,
                    subdomain: state.ticketing.subdomain || undefined,
                    clientId: state.ticketing.clientId || undefined,
                    clientSecret: state.ticketing.clientSecret || undefined,
                    freshdeskDomain: state.ticketing.freshdeskDomain || undefined,
                    freshdeskApiKey: state.ticketing.freshdeskApiKey || undefined
                  }
                }
              });
            } catch (err) {
              console.warn("Failed to set ticketing provider, falling back to native:", err);
            }
          }
        }
      }

      // 4. Configure AI Assistant (if enabled)
      if (state.aiSettings.enabled && state.aiSettings.apiKey?.trim()) {
        setLaunchStepMessage("Step 4/5: Configuring AI Assistant & SMTP Services...");
        try {
          await updateAiSettings({
            variables: {
              clientId: newClientId,
              input: {
                enabled: true,
                provider: state.aiSettings.provider,
                displayName: state.aiSettings.displayName || "CSA Assistant",
                model: state.aiSettings.model || "gpt-4o-mini",
                apiKey: state.aiSettings.apiKey.trim()
              }
            }
          });
        } catch (err) {
          console.warn("Failed to save AI settings:", err);
        }
      }

      // Configure SMTP Profile (if enabled)
      if (state.smtpProfile.enabled && state.smtpProfile.smtpHost?.trim()) {
        try {
          await createSmtpProfile({
            variables: {
              clientId: newClientId,
              input: {
                name: state.smtpProfile.name || "Default SMTP",
                smtpHost: state.smtpProfile.smtpHost.trim(),
                smtpPort: state.smtpProfile.smtpPort || 587,
                smtpSecure: state.smtpProfile.smtpSecure,
                smtpUser: state.smtpProfile.smtpUser?.trim() || undefined,
                smtpPassword: state.smtpProfile.smtpPassword?.trim() || undefined,
                emailFrom: state.smtpProfile.emailFrom?.trim() || "support@csa.local",
                isDefault: true
              }
            }
          });
        } catch (err) {
          console.warn("Failed to save SMTP profile:", err);
        }
      }

      // 5. Provision Team Members
      const draftMember = state.draftUser;
      const allMembersToProvision: typeof state.teamMembers = [...state.teamMembers];
      if (
        draftMember?.email?.trim() &&
        !allMembersToProvision.some((m) => m.email.toLowerCase() === draftMember.email!.trim().toLowerCase())
      ) {
        const draftEmail = draftMember.email.trim().toLowerCase();
        const draftMode = draftMember.mode || "create";
        const draftProjectKeys =
          draftMember.projectKeys && draftMember.projectKeys.length > 0
            ? draftMember.projectKeys
            : validProjects.map((p) => p.projectKey);
        if (draftMode === "assign" || (draftMode === "create" && draftMember.password && draftMember.password.length >= 8)) {
          allMembersToProvision.push({
            id: `user_draft_${Date.now()}`,
            mode: draftMode,
            email: draftEmail,
            firstName: draftMember.firstName?.trim() || undefined,
            lastName: draftMember.lastName?.trim() || undefined,
            password: draftMember.password || undefined,
            role: draftMember.role || "admin",
            projectKeys: draftProjectKeys
          });
        }
      }

      if (allMembersToProvision.length > 0) {
        setLaunchStepMessage("Step 5/5: Provisioning Team Access...");
        for (const member of allMembersToProvision) {
          const validKeys = member.projectKeys.filter(
            (k) => createdProjectMap[k] || validProjects.some((p) => p.projectKey === k)
          );
          const keysToUse =
            validKeys.length > 0
              ? validKeys
              : validProjects.map((p) => p.projectKey);

          const userProjects = keysToUse.map((k) => ({
            projectKey: k,
            role: member.role
          }));

          const memberEmail = member.email.trim().toLowerCase();

          try {
            if (member.mode === "create" && member.password) {
              try {
                await createClientUser({
                  variables: {
                    clientId: newClientId,
                    grantedBy: authorEmail,
                    input: {
                      email: memberEmail,
                      password: member.password,
                      firstName: member.firstName?.trim() || undefined,
                      lastName: member.lastName?.trim() || undefined,
                      projects: userProjects
                    }
                  }
                });
              } catch (createErr: unknown) {
                const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
                if (errMsg.toLowerCase().includes("already exists") || errMsg.toLowerCase().includes("duplicate")) {
                  console.info(`User ${memberEmail} already exists; assigning to projects...`);
                  await assignClientUser({
                    variables: {
                      clientId: newClientId,
                      grantedBy: authorEmail,
                      input: {
                        email: memberEmail,
                        projects: userProjects
                      }
                    }
                  });
                } else {
                  throw createErr;
                }
              }
            } else {
              try {
                await assignClientUser({
                  variables: {
                    clientId: newClientId,
                    grantedBy: authorEmail,
                    input: {
                      email: memberEmail,
                      projects: userProjects
                    }
                  }
                });
              } catch (assignErr: unknown) {
                const errMsg = assignErr instanceof Error ? assignErr.message : String(assignErr);
                if (member.password && (errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("does not exist"))) {
                  console.info(`User ${memberEmail} not found; creating account...`);
                  await createClientUser({
                    variables: {
                      clientId: newClientId,
                      grantedBy: authorEmail,
                      input: {
                        email: memberEmail,
                        password: member.password,
                        firstName: member.firstName?.trim() || undefined,
                        lastName: member.lastName?.trim() || undefined,
                        projects: userProjects
                      }
                    }
                  });
                } else {
                  throw assignErr;
                }
              }
            }
          } catch (err) {
            console.error(`Could not provision team member ${member.email}:`, err);
          }
        }
      }

      // Clear local draft upon successful launch
      if (typeof window !== "undefined") {
        localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
      }

      setCreatedClientId(newClientId);
      setIsSuccessOpen(true);
      }
    } catch (e) {
      setLaunchError(e instanceof Error ? e.message : "Failed to launch organization");
    } finally {
      setIsLaunching(false);
    }
  };

  const selectedThemeMeta = UI_THEME_OPTIONS.find((t) => t.id === state.uiTheme) || UI_THEME_OPTIONS[0];

  return (
    <OnboardingStepShell
      stepNumber={6}
      totalSteps={6}
      title={isEdit ? "Review & Update Organization" : "Review & Provision Organization"}
      description={
        isEdit
          ? "Inspect all configured settings, verify connection statuses, and save your updates to the organization. You can edit any section before proceeding."
          : "Inspect all configured settings, verify connection statuses, and launch the organization. You can edit any section before proceeding."
      }
      required
    >
      <div className="flex flex-col gap-6">
        {/* Validation Errors Alert (if any) */}
        {validationErrors.length > 0 && (
          <div className="rounded-m-xl border border-m-error-border bg-m-error-light/50 p-4">
            <div className="flex items-center gap-2 text-m-error font-bold text-xs uppercase tracking-wider mb-2">
              <Icon name="alert-triangle" size="xs" />
              <span>Please Resolve Required Configurations Before Launching:</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-m-error space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => onGoToStep(err.stepId)}
                    className="font-semibold underline hover:opacity-80"
                  >
                    {err.label}
                  </button>
                  : {err.issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section Cards Review Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Org Basics */}
          <ReviewSectionCard
            title="Organization Identity"
            stepId={1}
            onEdit={onGoToStep}
            status="configured"
          >
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-m-text-muted">Display Name:</span>
                <span className="font-bold text-m-text">{state.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Tenant Slug:</span>
                <span className="font-mono text-m-text">{state.slug || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Admin Contact:</span>
                <span className="font-mono text-m-text">{state.contactEmail || "—"}</span>
              </div>
            </div>
          </ReviewSectionCard>

          {/* Card 2: Appearance */}
          <ReviewSectionCard
            title="Appearance & Design"
            stepId={2}
            onEdit={onGoToStep}
            status={state.uiTheme === "csa-custom" ? "default" : "configured"}
          >
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-m-text-muted">UI Library:</span>
                <span className="font-bold text-m-text">{selectedThemeMeta.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Status:</span>
                <span className="text-m-text-muted">
                  {state.uiTheme === "csa-custom" ? "Native Default" : "Custom Adapter Selected"}
                </span>
              </div>
            </div>
          </ReviewSectionCard>

          {/* Card 3: Projects & Commerce */}
          <ReviewSectionCard
            title="Projects & Commerce Engine"
            stepId={3}
            onEdit={onGoToStep}
            status={validProjects.length > 0 ? "configured" : "error"}
          >
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-m-text-muted">Total Projects:</span>
                <span className="font-bold text-m-text">{validProjects.length}</span>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-m-border/40">
                {validProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-semibold text-m-primary">{p.projectKey}</span>
                    <span className="rounded bg-m-neutral-100 px-1.5 py-0.5 uppercase tracking-wider text-[10px] text-m-text">
                      {p.platform} · {p.shellMode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ReviewSectionCard>

          {/* Card 4: Consolidated Connectors & Integrations */}
          <ReviewSectionCard
            title="Connectors & Integrations"
            stepId={4}
            onEdit={onGoToStep}
            status="configured"
          >
            <div className="flex flex-col gap-2 text-xs">
              {/* Product Search */}
              <div className="flex justify-between items-center pb-1.5 border-b border-m-border/40">
                <span className="text-m-text-muted">Product Search:</span>
                <span className="font-semibold text-m-text">
                  {state.search?.provider === "algolia"
                    ? `Algolia (${state.search.indexName || "Active"})`
                    : "Native Commerce Search (Default)"}
                </span>
              </div>

              {/* Ticketing */}
              <div className="flex justify-between items-center pb-1.5 border-b border-m-border/40">
                <span className="text-m-text-muted">Ticketing Desk:</span>
                <span className="font-semibold text-m-text">
                  {state.ticketing?.provider === "zendesk"
                    ? `Zendesk (${state.ticketing.subdomain || "Active"})`
                    : state.ticketing?.provider === "freshdesk"
                      ? `Freshdesk (${state.ticketing.freshdeskDomain || "Active"})`
                      : "CSA Native Desk (Default)"}
                </span>
              </div>

              {/* AI Assistant */}
              <div className="flex justify-between items-center pb-1.5 border-b border-m-border/40">
                <span className="text-m-text-muted">AI Copilot:</span>
                <span className="font-semibold text-m-text">
                  {state.aiSettings?.enabled
                    ? `${state.aiSettings.provider.toUpperCase()} (${state.aiSettings.model || "Active"})`
                    : "Standard Engine (Default)"}
                </span>
              </div>

              {/* Email / SMTP */}
              <div className="flex justify-between items-center pb-1.5 border-b border-m-border/40">
                <span className="text-m-text-muted">Outbound Email:</span>
                <span className="font-semibold text-m-text">
                  {state.smtpProfile?.enabled
                    ? `Custom SMTP (${state.smtpProfile.smtpHost})`
                    : "System Default Mailer"}
                </span>
              </div>

              {/* SSO / Identity */}
              <div className="flex justify-between items-center">
                <span className="text-m-text-muted">Authentication / SSO:</span>
                <span className="font-semibold text-m-text">
                  {state.ssoConfig?.provider && state.ssoConfig.provider !== "none"
                    ? `${state.ssoConfig.provider.toUpperCase()} Federation`
                    : "Platform Credentials (Default)"}
                </span>
              </div>
            </div>
          </ReviewSectionCard>

          {/* Card 5: Team Members */}
          {(() => {
            const hasDraft =
              Boolean(state.draftUser?.email?.trim()) &&
              (state.draftUser?.mode === "assign" ||
                (Boolean(state.draftUser?.password) && (state.draftUser?.password?.length ?? 0) >= 8));
            const totalUsers = state.teamMembers.length + (hasDraft ? 1 : 0);
            return (
              <ReviewSectionCard
                title="Team & Access"
                stepId={5}
                onEdit={onGoToStep}
                status={totalUsers > 0 ? "configured" : "optional"}
              >
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-m-text-muted">Users to Provision:</span>
                    <span className="font-bold text-m-text">{totalUsers} user(s)</span>
                  </div>
                  {hasDraft && (
                    <p className="text-[11px] text-m-warning-dark font-medium">
                      ⚠ 1 user entered but not queued — will still be provisioned on launch.
                    </p>
                  )}
                  {totalUsers > 0 ? (
                    <p className="text-[11px] text-m-text-muted">
                      Users will be provisioned and assigned to their respective project keys immediately upon launch.
                    </p>
                  ) : (
                    <p className="text-[11px] text-m-text-muted">
                      No users queued. You can invite team members later from the Users tab.
                    </p>
                  )}
                </div>
              </ReviewSectionCard>
            );
          })()}
        </div>

        {/* Launch / Save Error Banner */}
        {launchError && (
          <div className="rounded-m-md border border-m-error-border bg-m-error-light p-4 text-xs text-m-error">
            <strong>{isEdit ? "Update Failed:" : "Launch Failed:"}</strong> {launchError}
          </div>
        )}

        {/* Launch / Update CTA Card */}
        <Card className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-2 border-m-primary bg-m-primary-50/20 shadow-m-card">
          <div className="flex flex-col gap-1">
            <span className="text-base font-extrabold text-m-text">
              {isEdit ? "Ready to Save Changes?" : "Ready to Launch Organization?"}
            </span>
            <span className="text-xs text-m-text-muted">
              {isEdit
                ? "Clicking save will update organization details, modify commerce connections, and update connector configurations."
                : "Clicking launch will provision the tenant account, configure commerce connections, and activate CSA."}
            </span>
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            rightIcon={isLaunching ? <LoadingSpinner size="sm" /> : <Icon name={isEdit ? "save" : "rocket"} size="sm" />}
            onClick={handleLaunch}
            disabled={!canLaunch}
            className="w-full sm:w-auto shrink-0 shadow-m-sm"
          >
            {isLaunching
              ? (launchStepMessage || (isEdit ? "Saving Changes..." : "Provisioning..."))
              : (isEdit ? "Save & Update Organization" : "Launch Organization")}
          </Button>
        </Card>
      </div>

      {/* Success Launch / Update Modal */}
      <Modal isOpen={isSuccessOpen} onClose={() => router.push("/superadmin/clients")}>
        <ModalHeader
          title={
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-m-success-light text-m-success">
                <Icon name="check-circle-2" size="sm" />
              </div>
              <span>{isEdit ? "Organization Successfully Updated!" : "Organization Successfully Launched!"}</span>
            </div>
          }
          subtitle={
            isEdit
              ? `Organization "${state.name}" settings have been saved successfully.`
              : `Organization "${state.name}" is now live on Customer Support Accelerator.`
          }
          onClose={() => router.push("/superadmin/clients")}
        />
        <ModalBody className="p-6">
          <div className="flex flex-col gap-4 text-xs text-m-text leading-relaxed">
            <p>
              Your multi-tenant workspace configuration is saved for slug{" "}
              <code className="rounded bg-m-neutral-100 px-1.5 py-0.5 font-mono text-m-primary font-bold">
                {state.slug}
              </code>
              .
            </p>

            <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-m-text-muted">Commerce Projects:</span>
                <span className="font-bold font-mono">{validProjects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Product Search:</span>
                <span className="font-bold">
                  {state.search?.provider === "algolia" ? "Algolia InstantSearch" : "Native Commerce Search"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Customer Ticketing:</span>
                <span className="font-bold">
                  {state.ticketing?.provider === "zendesk"
                    ? "Zendesk Support"
                    : state.ticketing?.provider === "freshdesk"
                      ? "Freshdesk"
                      : "CSA Native Desk"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Team Members:</span>
                <span className="font-bold font-mono">{state.teamMembers.length}</span>
              </div>
            </div>

            <p className="text-m-text-muted">
              {isEdit
                ? "All tenant configurations and connected services are updated and active."
                : "You can now access the client workspace, invite additional team members, or customize connector settings."}
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-3 p-4 border-t border-m-border/60 bg-m-surface-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (isEdit) {
                setIsSuccessOpen(false);
              } else if (createdClientId) {
                router.push(`/superadmin/clients/${createdClientId}`);
              } else {
                router.push("/superadmin/clients");
              }
            }}
          >
            {isEdit ? "Continue Editing" : "Manage Client Settings"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            rightIcon={<Icon name="arrow-right" size="xs" />}
            onClick={() => router.push("/superadmin/clients")}
          >
            {isEdit ? "Return to Organizations" : "Go to Clients Directory"}
          </Button>
        </ModalFooter>
      </Modal>
    </OnboardingStepShell>
  );
}

function ReviewSectionCard({
  title,
  stepId,
  onEdit,
  status,
  children
}: {
  title: string;
  stepId: StepId;
  onEdit: (stepId: StepId) => void;
  status: "configured" | "default" | "optional" | "error";
  children: React.ReactNode;
}) {
  const statusBadge = {
    configured: <Badge variant="success" size="sm">Configured</Badge>,
    default: <Badge variant="neutral" appearance="subtle" size="sm">Native Default</Badge>,
    optional: <Badge variant="neutral" appearance="subtle" size="sm">Not Configured</Badge>,
    error: <Badge variant="error" size="sm">Missing Info</Badge>
  }[status];

  return (
    <Card className="flex flex-col justify-between p-4 border border-m-border bg-m-surface shadow-xs">
      <div>
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-m-border/60">
          <span className="text-xs font-bold text-m-text">{title}</span>
          <div className="flex items-center gap-2">
            {statusBadge}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(stepId)}
              className="text-m-primary hover:text-m-primary-600 px-1.5"
            >
              Edit
            </Button>
          </div>
        </div>
        <div>{children}</div>
      </div>
    </Card>
  );
}

// Backwards-compatible export
export { Step6ReviewLaunch as Step8ReviewLaunch };
