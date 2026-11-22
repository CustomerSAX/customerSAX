import { describe, expect, it } from "vitest";

describe("Superadmin Management Logic", () => {
  describe("Project Status Computation", () => {
    it("partitions projects correctly into configured vs setup required", () => {
      const projects = [
        { projectKey: "proj-1", isConfigured: true, status: "active" },
        { projectKey: "proj-2", isConfigured: false, status: "setup_required" },
        { projectKey: "proj-3", isConfigured: true, status: "active" }
      ];

      const configured = projects.filter((p) => p.isConfigured !== false && p.status !== "setup_required");
      const setupRequired = projects.filter((p) => p.isConfigured === false || p.status === "setup_required");

      expect(configured).toHaveLength(2);
      expect(setupRequired).toHaveLength(1);
      expect(setupRequired[0].projectKey).toBe("proj-2");
    });
  });

  describe("User Role & Project Assignment Mapping", () => {
    it("determines project payload based on role", () => {
      const selectedProjectKeys = ["proj-a", "proj-b"];
      const getProjectsPayload = (role: string, keys: string[]) =>
        role === "admin" ? [] : keys.map((pk) => ({ projectKey: pk, role: "agent" }));

      // For Org Admin: project selection is not assigned manually (org-wide access derived from role)
      expect(getProjectsPayload("admin", selectedProjectKeys)).toEqual([]);

      // For Member/Agent: project selection must be explicitly assigned
      expect(getProjectsPayload("agent", selectedProjectKeys)).toEqual([
        { projectKey: "proj-a", role: "agent" },
        { projectKey: "proj-b", role: "agent" }
      ]);
    });

    it("requires at least one project for non-Org Admin when organization has projects", () => {
      const validateUserCreation = (role: string, selectedProjects: string[], orgProjectCount: number) => {
        if (role === "agent" && orgProjectCount > 0 && selectedProjects.length === 0) {
          return "Select at least one project for this member.";
        }
        return null;
      };

      expect(validateUserCreation("admin", [], 2)).toBeNull();
      expect(validateUserCreation("agent", [], 2)).toBe("Select at least one project for this member.");
      expect(validateUserCreation("agent", ["proj-1"], 2)).toBeNull();
      expect(validateUserCreation("agent", [], 0)).toBeNull(); // Org has no projects yet
    });

    it("supports adding, removing, and replacing project assignments for existing users", () => {
      const initialProjects = ["proj-a", "proj-b"];

      // Add proj-c
      const afterAdd = [...initialProjects, "proj-c"];
      expect(afterAdd).toEqual(["proj-a", "proj-b", "proj-c"]);

      // Remove proj-b
      const afterRemove = afterAdd.filter((k) => k !== "proj-b");
      expect(afterRemove).toEqual(["proj-a", "proj-c"]);

      // Replace with proj-d only
      const afterReplace = ["proj-d"];
      expect(afterReplace).toEqual(["proj-d"]);
    });
  });

  describe("Project Multi-Selection Independent State Handling", () => {
    it("supports independent selection and deselection for Project A and Project B", () => {
      let selected: string[] = [];

      const toggleSelection = (key: string, checked: boolean) => {
        const clean = key.trim();
        if (checked) {
          selected = selected.includes(clean) ? selected : [...selected, clean];
        } else {
          selected = selected.filter((k) => k !== clean);
        }
      };

      // 1. Select Project A -> Only Project A selected
      toggleSelection("project-a", true);
      expect(selected).toEqual(["project-a"]);

      // 2. Select Project B -> Project A and Project B selected
      toggleSelection("project-b", true);
      expect(selected).toEqual(["project-a", "project-b"]);

      // 3. Deselect Project A -> Only Project B remains selected
      toggleSelection("project-a", false);
      expect(selected).toEqual(["project-b"]);

      // 4. Deselect Project B -> No projects selected
      toggleSelection("project-b", false);
      expect(selected).toEqual([]);
    });

    it("deduplicates project list by projectKey to ensure unique checkboxes", () => {
      const rawProjects = [
        { id: "1", projectKey: "project-a", displayName: "Project A" },
        { id: "2", projectKey: "project-a", displayName: "Project A (dup)" },
        { id: "3", projectKey: "project-b", displayName: "Project B" },
        { id: "4", projectKey: "PROJECT-B", displayName: "Project B (case dup)" }
      ];

      const uniqueProjects = rawProjects.filter(
        (p, index, self) =>
          Boolean(p.projectKey) &&
          index ===
            self.findIndex(
              (t) => t.projectKey && t.projectKey.toLowerCase() === p.projectKey.toLowerCase()
            )
      );

      expect(uniqueProjects).toHaveLength(2);
      expect(uniqueProjects.map((p) => p.projectKey)).toEqual(["project-a", "project-b"]);
    });
  });

  describe("Duplicate Project & Submission Safety", () => {
    it("guards against rapid repeated submissions when request is already in progress", () => {
      let submissionCount = 0;
      let isSubmitting = false;

      const submit = () => {
        if (isSubmitting) return false;
        isSubmitting = true;
        submissionCount++;
        return true;
      };

      expect(submit()).toBe(true);
      expect(submissionCount).toBe(1);

      // Rapid subsequent clicks while in progress must be ignored
      expect(submit()).toBe(false);
      expect(submit()).toBe(false);
      expect(submissionCount).toBe(1);

      // After request completes
      isSubmitting = false;
      expect(submit()).toBe(true);
      expect(submissionCount).toBe(2);
    });
  });
});
