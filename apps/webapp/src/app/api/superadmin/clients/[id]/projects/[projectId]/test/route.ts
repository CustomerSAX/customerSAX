/**
 * POST /api/superadmin/clients/[id]/projects/[projectId]/test
 *
 * Tests the stored credentials for a project against the real platform API
 * (CT client_credentials token request, Shopify shop.json, or BigCommerce
 * store endpoint) — never simulated/faked.
 *
 * Returns: { ok: boolean, message: string, scopes?: string }
 * Requires superadmin role (see lib/get-current-user.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forbidUnlessSuperadmin } from '@/lib/forbid-unless-superadmin';

type RouteContext = { params: Promise<{ id: string; projectId: string }> };

export async function POST(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const user = await getCurrentUser();
  const denied = forbidUnlessSuperadmin(user);
  if (denied) return denied;

  const { id, projectId } = await context.params;

  try {
    const { findProjectById, getProjectWithSecret } = await import('@/lib/mongo-projects');

    const project = await findProjectById(projectId);
    if (!project || project.clientId !== id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const withSecret = await getProjectWithSecret(projectId);
    if (!withSecret) {
      return NextResponse.json({ error: 'Could not decrypt project credentials' }, { status: 500 });
    }

    if (withSecret.platform === 'shopify') {
      const storeDomain = (withSecret.shopifyStoreDomain ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const token = (withSecret.shopifyAdminAccessToken ?? '').trim();
      const apiVersion = (withSecret.shopifyApiVersion || '2024-01').trim();

      if (!storeDomain || !token) {
        return NextResponse.json({ ok: false, message: 'Missing Shopify store domain or access token.' });
      }

      const response = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/shop.json`, {
        method: 'GET',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return NextResponse.json({ ok: true, message: 'Connection successful — Shopify credentials are valid' });
      }
      const errText = await response.text().catch(() => response.statusText);
      return NextResponse.json({ ok: false, message: `Shopify authentication failed (HTTP ${response.status}): ${errText}` });
    }

    if (withSecret.platform === 'bigcommerce') {
      const storeHash = (withSecret.bigcommerceStoreHash ?? '').trim();
      const clientId = (withSecret.bigcommerceClientId ?? '').trim();
      const token = (withSecret.bigcommerceAccessToken ?? '').trim();

      if (!storeHash || !clientId || !token) {
        return NextResponse.json({ ok: false, message: 'Missing BigCommerce store hash, client ID, or access token.' });
      }

      const response = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/store`, {
        method: 'GET',
        headers: { 'X-Auth-Client': clientId, 'X-Auth-Token': token, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return NextResponse.json({ ok: true, message: 'Connection successful — BigCommerce credentials are valid' });
      }
      const errText = await response.text().catch(() => response.statusText);
      return NextResponse.json({ ok: false, message: `BigCommerce authentication failed (HTTP ${response.status}): ${errText}` });
    }

    if (withSecret.platform !== 'commercetools') {
      return NextResponse.json({ ok: false, message: `Connection test for the "${withSecret.platform}" platform is not supported yet.` });
    }

    const scopes = withSecret.scopes?.trim() || `manage_project:${withSecret.projectKey}`;
    const tokenUrl = `${withSecret.ctAuthUrl.replace(/\/+$/, '')}/oauth/token`;
    const clientIdStr = (withSecret.ctClientId || '').trim();
    const clientSecretStr = (withSecret.ctClientSecret || '').trim();
    const credentials = Buffer.from(`${clientIdStr}:${clientSecretStr}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scopes)}`,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = (await response.json()) as { scope?: string; expires_in?: number };
      return NextResponse.json({
        ok: true,
        message: 'Connection successful — credentials are valid',
        scopes: data.scope,
        expiresIn: data.expires_in,
      });
    }

    const errText = await response.text().catch(() => response.statusText);
    return NextResponse.json({ ok: false, message: `CT authentication failed (HTTP ${response.status}): ${errText}` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[superadmin/projects/test] Connection test failed:', error);
    return NextResponse.json({ ok: false, message: `Connection error: ${msg}` });
  }
}
