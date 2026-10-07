"use client";

import { useState, useEffect } from "react";
import { Badge, Button, Card, Checkbox, Icon, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@csa/ui";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import type { OnboardingState, TeamMemberDraft } from "../types";

interface Step5TeamAccessProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext?: () => void;
  mode?: "create" | "edit";
}

export function Step5TeamAccess({ state, onChange, mode: wizardMode = "create" }: Step5TeamAccessProps) {
  const isEdit = wizardMode === "edit";
  const availableProjects = state.projects.filter((p) => Boolean(p.projectKey?.trim()));

  const draft = state.draftUser || {};
  const mode = draft.mode || "create";
  const email = draft.email || "";
  const firstName = draft.firstName || "";
  const lastName = draft.lastName || "";
  const password = draft.password || "";
  const role = draft.role || "admin";
  const selectedProjectKeys =
    draft.projectKeys && draft.projectKeys.length > 0
      ? draft.projectKeys
      : availableProjects.map((p) => p.projectKey);

  const [formError, setFormError] = useState<string | null>(null);

  // If projects list changed and draft has no projectKeys set, initialize them
  useEffect(() => {
    if ((!draft.projectKeys || draft.projectKeys.length === 0) && availableProjects.length > 0) {
      onChange({
        draftUser: {
          ...draft,
          projectKeys: availableProjects.map((p) => p.projectKey)
        }
      });
    }
  }, [availableProjects.length]);

  const updateDraft = (patch: Partial<TeamMemberDraft>) => {
    setFormError(null);
    onChange({
      draftUser: {
        mode,
        email,
        firstName,
        lastName,
        password,
        role,
        projectKeys: selectedProjectKeys,
        ...patch
      }
    });
  };

  const toggleProject = (projectKey: string) => {
    const next = selectedProjectKeys.includes(projectKey)
      ? selectedProjectKeys.filter((k) => k !== projectKey)
      : [...selectedProjectKeys, projectKey];
    updateDraft({ projectKeys: next });
  };

  const commitDraftUser = (): boolean => {
    setFormError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return true; // empty is allowed (optional step)

    if (mode === "create" && (!password || password.length < 8)) {
      setFormError("Password must be at least 8 characters.");
      return false;
    }
    if (selectedProjectKeys.length === 0) {
      setFormError("Select at least one project for this user.");
      return false;
    }
    if (state.teamMembers.some((m) => m.email.toLowerCase() === trimmedEmail)) {
      setFormError("A user with this email has already been added.");
      return false;
    }

    const newMember: TeamMemberDraft = {
      id: `user_${Date.now()}`,
      mode,
      email: trimmedEmail,
      firstName: mode === "create" ? firstName.trim() || undefined : undefined,
      lastName: mode === "create" ? lastName.trim() || undefined : undefined,
      password: mode === "create" ? password : undefined,
      role,
      projectKeys: [...selectedProjectKeys]
    };

    onChange({
      teamMembers: [...state.teamMembers, newMember],
      draftUser: null
    });
    return true;
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    commitDraftUser();
  };

  const handleRemoveMember = (id: string) => {
    onChange({ teamMembers: state.teamMembers.filter((m) => m.id !== id) });
  };

  return (
    <OnboardingStepShell
      stepNumber={5}
      totalSteps={6}
      title="Team Members & Initial Access"
      description="Create initial administrator accounts or assign existing platform users to the projects created in Step 3. Project-level permissions and roles are established here."
      tip="This step is optional. You can launch without adding users and invite team members later from the Users tab."
    >
      <div className="flex flex-col gap-6">
        {/* User Entry Form */}
        <Card className="p-5 border border-m-border bg-m-surface shadow-m-card flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-m-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Icon name="user-plus" size="xs" className="text-m-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-m-text">
                Add Team Member
              </span>
            </div>
            <span className="text-[11px] text-m-text-muted">
              Step 5 of 6 · Optional
            </span>
          </div>

          <form onSubmit={handleAddMember} className="flex flex-col gap-4">
            {/* Mode Selector */}
            <div className="flex flex-col gap-1.5 max-w-sm">
              <label className="text-xs font-semibold text-m-text">Action</label>
              <div className="flex rounded-m-md border border-m-border bg-m-neutral-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => updateDraft({ mode: "create" })}
                  className={`flex-1 rounded-m-sm py-1.5 text-center font-medium transition-all ${
                    mode === "create"
                      ? "bg-white text-m-primary font-bold shadow-xs"
                      : "text-m-text-muted hover:text-m-text"
                  }`}
                >
                  Create New User
                </button>
                <button
                  type="button"
                  onClick={() => updateDraft({ mode: "assign" })}
                  className={`flex-1 rounded-m-sm py-1.5 text-center font-medium transition-all ${
                    mode === "assign"
                      ? "bg-white text-m-primary font-bold shadow-xs"
                      : "text-m-text-muted hover:text-m-text"
                  }`}
                >
                  Assign Existing User
                </button>
              </div>
            </div>

            {/* Email Field */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text">
                  Email Address <span className="text-m-error">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => updateDraft({ email: e.target.value })}
                  placeholder="agent@company.com"
                  className="text-xs"
                />
              </div>

              {/* Role Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text">
                  Assigned Role <span className="text-m-error">*</span>
                </label>
                <Select
                  value={role}
                  onChange={(e) =>
                    updateDraft({
                      role: e.target.value as "admin" | "member" | "customer_service_agent"
                    })
                  }
                  className="text-xs"
                >
                  <option value="admin">Administrator (Full org & project settings)</option>
                  <option value="customer_service_agent">Customer Service Agent (Desk & order actions)</option>
                  <option value="member">Viewer / Read Only Member</option>
                </Select>
              </div>
            </div>

            {/* First & Last Name (Create Mode only) */}
            {mode === "create" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">First Name</label>
                  <Input
                    value={firstName}
                    onChange={(e) => updateDraft({ firstName: e.target.value })}
                    placeholder="Jane"
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">Last Name</label>
                  <Input
                    value={lastName}
                    onChange={(e) => updateDraft({ lastName: e.target.value })}
                    placeholder="Doe"
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* Password (Create Mode only) */}
            {mode === "create" && (
              <div className="flex flex-col gap-1.5 max-w-md">
                <label className="text-xs font-semibold text-m-text">
                  Temporary Password <span className="text-m-error">*</span>
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => updateDraft({ password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="font-mono text-xs"
                />
                <span className="text-[11px] text-m-text-muted">
                  The user can update this password after their first sign-in.
                </span>
              </div>
            )}

            {/* Project Assignment Checkboxes */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-m-text">
                Project Assignments <span className="text-m-error">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {availableProjects.map((p) => {
                  const isChecked = selectedProjectKeys.includes(p.projectKey);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2.5 rounded-m-lg border p-3 cursor-pointer text-xs transition-colors ${
                        isChecked
                          ? "border-m-primary bg-m-primary-50/40 text-m-primary font-semibold"
                          : "border-m-border bg-m-surface hover:bg-m-neutral-50 text-m-text"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onChange={() => toggleProject(p.projectKey)}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-xs truncate">{p.projectKey}</span>
                        <span className="text-[10px] text-m-text-muted capitalize">
                          {p.displayName || p.platform}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Form Error Alert */}
            {formError && (
              <div className="rounded-m-md border border-m-error-border bg-m-error-light p-3 text-xs text-m-error">
                {formError}
              </div>
            )}

            {/* Add User Action Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                leftIcon={<Icon name="plus" size="xs" />}
                disabled={!email.trim() || selectedProjectKeys.length === 0}
              >
                Add Member to Queue
              </Button>
            </div>
          </form>
        </Card>

        {/* Queued Team Members Table */}
        {state.teamMembers.length > 0 && (
          <Card className="border border-m-border bg-m-surface shadow-m-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-m-border/60">
              <div className="flex items-center gap-2">
                <Icon name="users" size="xs" className="text-m-primary" />
                <span className="text-xs font-bold text-m-text">
                  {isEdit ? `Team Members (${state.teamMembers.length})` : `Queued Members (${state.teamMembers.length})`}
                </span>
              </div>
              <span className="text-[11px] text-m-text-muted">
                {isEdit ? "Configured organization members" : "Will be provisioned upon launch"}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User / Email</TableHead>
                  <TableHead className="text-xs">Status / Mode</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Assigned Projects</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="text-xs font-medium">
                      <div className="flex flex-col">
                        <span className="font-bold text-m-text">
                          {member.firstName || member.lastName
                            ? `${member.firstName || ""} ${member.lastName || ""}`.trim()
                            : member.email}
                        </span>
                        <span className="font-mono text-[11px] text-m-text-muted">
                          {member.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {member.isExisting ? (
                        <Badge variant="success" size="sm" className="uppercase text-[10px]">
                          Existing
                        </Badge>
                      ) : (
                        <Badge
                          variant={member.mode === "create" ? "primary" : "neutral"}
                          size="sm"
                          className="uppercase text-[10px]"
                        >
                          {member.mode}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="capitalize text-m-text font-medium">
                        {member.role.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {member.projectKeys.map((k) => (
                          <span
                            key={k}
                            className="rounded bg-m-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-m-text"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-m-error hover:bg-m-error-light"
                      >
                        <Icon name="trash-2" size="xs" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </OnboardingStepShell>
  );
}

// Backwards-compatible export
export { Step5TeamAccess as Step7TeamAccess };
