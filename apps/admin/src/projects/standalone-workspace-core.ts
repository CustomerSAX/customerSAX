/**
 * CSA workspace shell-mode helpers — browser-safe (no Mongo/Node-only imports).
 *
 * Ported (the one function this repo's superadmin Projects tab needs) from
 * ct-csa-standalone's lib/standalone-workspace-core.ts.
 */

type ProjectStandaloneFields = { standaloneB2cEnabled?: boolean; standaloneB2bEnabled?: boolean };

function normalizedProjectStandaloneConfig(
  project: ProjectStandaloneFields | null | undefined
): { b2cEnabled: boolean; b2bEnabled: boolean } {
  if (!project) {
    return { b2cEnabled: true, b2bEnabled: false };
  }
  return {
    b2cEnabled: project.standaloneB2cEnabled !== false,
    b2bEnabled: project.standaloneB2bEnabled === true,
  };
}

export type StandaloneShellMode = 'b2c' | 'b2b';

function projectShellFlagsFromMode(mode: StandaloneShellMode): {
  standaloneB2cEnabled: boolean;
  standaloneB2bEnabled: boolean;
} {
  if (mode === 'b2b') {
    return { standaloneB2cEnabled: false, standaloneB2bEnabled: true };
  }
  return { standaloneB2cEnabled: true, standaloneB2bEnabled: false };
}

/**
 * Enforce exactly one shell per project (B2C xor B2B). Returns null when
 * neither shell is selected; normalizes to B2B when both were set.
 */
export function normalizeExclusiveProjectShellFlags(
  project: ProjectStandaloneFields | null | undefined
): { standaloneB2cEnabled: boolean; standaloneB2bEnabled: boolean } | null {
  const { b2cEnabled, b2bEnabled } = normalizedProjectStandaloneConfig(project);
  if (!b2cEnabled && !b2bEnabled) return null;
  return projectShellFlagsFromMode(b2bEnabled ? 'b2b' : 'b2c');
}
