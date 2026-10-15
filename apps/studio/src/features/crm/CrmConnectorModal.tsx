"use client";

import { useState } from "react";
import { FormField, Label, Modal, Select } from "@csa/ui";
import { CrmSettings, type CrmSettingsProject } from "./CrmSettings";

export interface CrmConnectorProject extends CrmSettingsProject {
  projectKey: string;
  crmProvider?: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  zoho: "Zoho CRM"
};

/**
 * CRM is chosen per project (each project reserves its own CRM account), so
 * the connector opens on one project at a time with a picker to switch.
 */
export function CrmConnectorModal({
  isOpen,
  onClose,
  clientId,
  projects,
  initialProjectId,
  initialProvider,
  onSaved
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  projects: CrmConnectorProject[];
  initialProjectId?: string;
  initialProvider?: string;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === projectId) ?? projects[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" aria-label="CRM connector">
      {!project ? (
        <p className="p-6 text-sm text-m-text-muted">This organization has no projects yet. Create a project before connecting a CRM.</p>
      ) : (
        <>
          {projects.length > 1 && (
            <div className="border-b border-m-border px-6 pt-5 pb-4">
              <FormField>
                <Label>Project</Label>
                <Select
                  value={project.id}
                  onChange={(e) => setProjectId(e.target.value)}
                  options={projects.map((p) => ({
                    value: p.id,
                    label: `${p.displayName} (${p.projectKey})${
                      p.crmProvider && p.crmProvider !== "none" ? ` · ${PROVIDER_LABEL[p.crmProvider] ?? p.crmProvider}` : ""
                    }`
                  }))}
                />
              </FormField>
              <p className="mt-1.5 text-[11px] text-m-text-muted">
                Each project connects its own CRM account; switching a project to another CRM releases its current one.
              </p>
            </div>
          )}
          <CrmSettings
            key={project.id}
            clientId={clientId}
            project={project}
            initialProvider={initialProvider}
            onClose={onClose}
            onSaved={onSaved}
          />
        </>
      )}
    </Modal>
  );
}
