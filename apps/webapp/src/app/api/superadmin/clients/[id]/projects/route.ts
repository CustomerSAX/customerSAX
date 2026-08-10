/**
 * GET  /api/superadmin/clients/[id]/projects — list commerce projects for a client
 * POST /api/superadmin/clients/[id]/projects — add a commerce project to a client
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

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/superadmin/clients/[id]/projects */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const { findClientById } = await import('@/lib/mongo-clients');
    const { listProjectsByClient } = await import('@/lib/mongo-projects');

    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const projects = await listProjectsByClient(id);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[superadmin/clients/[id]/projects] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/clients/[id]/projects
 * Adds a new commerce project under the given client. Secrets are encrypted
 * before storage.
 *
 * Body varies by `platform` ('commercetools' | 'shopify' | 'bigcommerce').
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const adminEmail = (auth as { email: string }).email;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      platform?: 'commercetools' | 'shopify' | 'bigcommerce';
      projectKey?: string;
      displayName?: string;
      ctApiUrl?: string;
      ctAuthUrl?: string;
      ctClientId?: string;
      ctClientSecret?: string;
      scopes?: string;
      shopifyStoreDomain?: string;
      shopifyAdminAccessToken?: string;
      shopifyApiVersion?: string;
      bigcommerceStoreHash?: string;
      bigcommerceClientId?: string;
      bigcommerceAccessToken?: string;
      standaloneB2cEnabled?: boolean;
      standaloneB2bEnabled?: boolean;
    };

    const {
      platform,
      projectKey,
      displayName,
      ctApiUrl,
      ctAuthUrl,
      ctClientId,
      ctClientSecret,
      scopes,
      shopifyStoreDomain,
      shopifyAdminAccessToken,
      shopifyApiVersion,
      bigcommerceStoreHash,
      bigcommerceClientId,
      bigcommerceAccessToken,
      standaloneB2cEnabled,
      standaloneB2bEnabled,
    } = body ?? {};

    const resolvedPlatform = platform ?? 'commercetools';
    if (resolvedPlatform !== 'commercetools' && resolvedPlatform !== 'shopify' && resolvedPlatform !== 'bigcommerce') {
      return NextResponse.json({ error: `Unsupported platform "${resolvedPlatform}".` }, { status: 400 });
    }

    if (!projectKey || !displayName) {
      return NextResponse.json({ error: 'projectKey and displayName are required' }, { status: 400 });
    }
    if (resolvedPlatform === 'shopify') {
      if (!shopifyStoreDomain || !shopifyAdminAccessToken || !shopifyApiVersion) {
        return NextResponse.json(
          { error: 'Shopify projects require shopifyStoreDomain, shopifyAdminAccessToken, and shopifyApiVersion' },
          { status: 400 }
        );
      }
    } else if (resolvedPlatform === 'bigcommerce') {
      if (!bigcommerceStoreHash || !bigcommerceClientId || !bigcommerceAccessToken) {
        return NextResponse.json(
          { error: 'BigCommerce projects require bigcommerceStoreHash, bigcommerceClientId, and bigcommerceAccessToken' },
          { status: 400 }
        );
      }
    } else if (!ctApiUrl || !ctAuthUrl || !ctClientId || !ctClientSecret) {
      return NextResponse.json(
        { error: 'CommerceTools projects require ctApiUrl, ctAuthUrl, ctClientId, and ctClientSecret' },
        { status: 400 }
      );
    }

    const { findClientById } = await import('@/lib/mongo-clients');
    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.status === 'blocked') {
      return NextResponse.json({ error: 'Cannot add projects to a blocked client' }, { status: 403 });
    }

    const { normalizeExclusiveProjectShellFlags } = await import('@/lib/standalone-workspace-core');
    const modeCheck = normalizeExclusiveProjectShellFlags({
      standaloneB2cEnabled: standaloneB2cEnabled !== undefined ? standaloneB2cEnabled : true,
      standaloneB2bEnabled: standaloneB2bEnabled !== undefined ? standaloneB2bEnabled : false,
    });
    if (!modeCheck) {
      return NextResponse.json(
        { error: 'Select either the B2C shell or the B2B shell for this project.' },
        { status: 400 }
      );
    }

    const { createProject } = await import('@/lib/mongo-projects');
    const project = await createProject({
      clientId: id,
      platform: resolvedPlatform,
      projectKey,
      displayName,
      ctApiUrl,
      ctAuthUrl,
      ctClientId,
      ctClientSecret,
      scopes,
      shopifyStoreDomain,
      shopifyAdminAccessToken,
      shopifyApiVersion,
      bigcommerceStoreHash,
      bigcommerceClientId,
      bigcommerceAccessToken,
      createdBy: adminEmail,
      standaloneB2cEnabled: modeCheck.standaloneB2cEnabled,
      standaloneB2bEnabled: modeCheck.standaloneB2bEnabled,
    });

    return NextResponse.json({ message: 'Project added', project }, { status: 201 });
  } catch (error) {
    console.error('[superadmin/clients/[id]/projects] POST failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to add project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
