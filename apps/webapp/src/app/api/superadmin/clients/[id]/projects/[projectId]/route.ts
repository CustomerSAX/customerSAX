/**
 * GET    /api/superadmin/clients/[id]/projects/[projectId] — get a single project
 * PUT    /api/superadmin/clients/[id]/projects/[projectId] — update project fields
 * DELETE /api/superadmin/clients/[id]/projects/[projectId] — remove project from client
 *
 * Requires superadmin role (see lib/get-current-user.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forbidUnlessSuperadmin } from '@/lib/forbid-unless-superadmin';

async function requireSuperadmin(): Promise<{ email: string } | NextResponse> {
  const user = await getCurrentUser();
  const denied = forbidUnlessSuperadmin(user);
  if (denied) return denied;
  return { email: user!.email };
}

type RouteContext = { params: Promise<{ id: string; projectId: string }> };

/** GET — returns a single project (with masked secret). */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id, projectId } = await context.params;

  try {
    const { findProjectById } = await import('@/lib/mongo-projects');
    const project = await findProjectById(projectId);

    if (!project || project.clientId !== id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[superadmin/clients/[id]/projects/[projectId]] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

/**
 * PUT — updates mutable project fields. Providing a secret field
 * re-encrypts it; omitting it leaves the stored secret unchanged.
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id, projectId } = await context.params;

  try {
    const body = (await request.json()) as {
      displayName?: string;
      ctApiUrl?: string;
      ctAuthUrl?: string;
      ctClientId?: string;
      ctClientSecret?: string;
      scopes?: string;
      smtpProfileId?: string | null;
      standaloneB2cEnabled?: boolean;
      standaloneB2bEnabled?: boolean;
      shopifyStoreDomain?: string;
      shopifyAdminAccessToken?: string;
      shopifyApiVersion?: string;
      bigcommerceStoreHash?: string;
      bigcommerceClientId?: string;
      bigcommerceAccessToken?: string;
    };

    const { findProjectById, updateProject } = await import('@/lib/mongo-projects');
    const { normalizeExclusiveProjectShellFlags } = await import('@/lib/standalone-workspace-core');
    const existing = await findProjectById(projectId);

    if (!existing || existing.clientId !== id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const shellTouched = body.standaloneB2cEnabled !== undefined || body.standaloneB2bEnabled !== undefined;
    let exclusiveShellFlags: { standaloneB2cEnabled: boolean; standaloneB2bEnabled: boolean } | null = null;

    if (shellTouched) {
      exclusiveShellFlags = normalizeExclusiveProjectShellFlags({
        standaloneB2cEnabled: body.standaloneB2cEnabled !== undefined ? body.standaloneB2cEnabled : existing.standaloneB2cEnabled,
        standaloneB2bEnabled: body.standaloneB2bEnabled !== undefined ? body.standaloneB2bEnabled : existing.standaloneB2bEnabled,
      });
      if (!exclusiveShellFlags) {
        return NextResponse.json(
          { error: 'Select either the B2C shell or the B2B shell for this project.' },
          { status: 400 }
        );
      }
    }

    const updated = await updateProject(projectId, {
      displayName: body.displayName,
      ctApiUrl: body.ctApiUrl,
      ctAuthUrl: body.ctAuthUrl,
      ctClientId: body.ctClientId,
      ctClientSecret: body.ctClientSecret || undefined,
      scopes: body.scopes,
      smtpProfileId: body.smtpProfileId,
      standaloneB2cEnabled: exclusiveShellFlags?.standaloneB2cEnabled,
      standaloneB2bEnabled: exclusiveShellFlags?.standaloneB2bEnabled,
      shopifyStoreDomain: body.shopifyStoreDomain,
      shopifyAdminAccessToken: body.shopifyAdminAccessToken || undefined,
      shopifyApiVersion: body.shopifyApiVersion,
      bigcommerceStoreHash: body.bigcommerceStoreHash,
      bigcommerceClientId: body.bigcommerceClientId,
      bigcommerceAccessToken: body.bigcommerceAccessToken || undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    const project = await findProjectById(projectId);
    return NextResponse.json({ message: 'Project updated', project });
  } catch (error) {
    console.error('[superadmin/clients/[id]/projects/[projectId]] PUT failed:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

/** DELETE — permanently removes the project from the client. */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id, projectId } = await context.params;

  try {
    const { findProjectById, deleteProject } = await import('@/lib/mongo-projects');
    const existing = await findProjectById(projectId);

    if (!existing || existing.clientId !== id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await deleteProject(projectId);
    return NextResponse.json({ message: `Project '${existing.projectKey}' removed` });
  } catch (error) {
    console.error('[superadmin/clients/[id]/projects/[projectId]] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to remove project' }, { status: 500 });
  }
}
