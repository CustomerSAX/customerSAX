/**
 * Tests project credentials against the real platform API (CT
 * client_credentials token request, Shopify shop.json, or BigCommerce
 * store endpoint) — never simulated/faked. Works both on an already-saved
 * project (by id) and on raw unsaved form input (used by the Add Project
 * modal's "Test Connection" button before the project exists at all).
 */

import { getProjectWithSecret } from "./repository.js";

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  scopes?: string;
  expiresIn?: number;
}

export interface RawCredentials {
  platform: "commercetools" | "shopify" | "bigcommerce";
  projectKey?: string;
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
}

export async function testCredentials(creds: RawCredentials): Promise<ConnectionTestResult> {
  try {
    if (creds.platform === "shopify") {
      const storeDomain = (creds.shopifyStoreDomain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const token = (creds.shopifyAdminAccessToken ?? "").trim();
      const apiVersion = (creds.shopifyApiVersion || "2024-01").trim();

      if (!storeDomain || !token) {
        return { ok: false, message: "Missing Shopify store domain or access token." };
      }

      const response = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/shop.json`, {
        method: "GET",
        headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return { ok: true, message: "Connection successful — Shopify credentials are valid" };
      }
      const errText = await response.text().catch(() => response.statusText);
      return { ok: false, message: `Shopify authentication failed (HTTP ${response.status}): ${errText}` };
    }

    if (creds.platform === "bigcommerce") {
      const storeHash = (creds.bigcommerceStoreHash ?? "").trim();
      const clientId = (creds.bigcommerceClientId ?? "").trim();
      const token = (creds.bigcommerceAccessToken ?? "").trim();

      if (!storeHash || !clientId || !token) {
        return { ok: false, message: "Missing BigCommerce store hash, client ID, or access token." };
      }

      const response = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/store`, {
        method: "GET",
        headers: { "X-Auth-Client": clientId, "X-Auth-Token": token, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return { ok: true, message: "Connection successful — BigCommerce credentials are valid" };
      }
      const errText = await response.text().catch(() => response.statusText);
      return { ok: false, message: `BigCommerce authentication failed (HTTP ${response.status}): ${errText}` };
    }

    if (creds.platform !== "commercetools") {
      return { ok: false, message: `Connection test for the "${creds.platform}" platform is not supported yet.` };
    }

    if (!creds.ctAuthUrl || !creds.ctClientId || !creds.ctClientSecret) {
      return { ok: false, message: "Missing CT auth URL, client ID, or client secret." };
    }

    const scopes = creds.scopes?.trim() || `manage_project:${creds.projectKey ?? ""}`;
    const tokenUrl = `${creds.ctAuthUrl.replace(/\/+$/, "")}/oauth/token`;
    const credentials = Buffer.from(`${creds.ctClientId.trim()}:${creds.ctClientSecret.trim()}`).toString("base64");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scopes)}`,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = (await response.json()) as { scope?: string; expires_in?: number };
      return {
        ok: true,
        message: "Connection successful — credentials are valid",
        scopes: data.scope,
        expiresIn: data.expires_in,
      };
    }

    const errText = await response.text().catch(() => response.statusText);
    return { ok: false, message: `CT authentication failed (HTTP ${response.status}): ${errText}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[admin/testCredentials]", error);
    return { ok: false, message: `Connection error: ${msg}` };
  }
}

/** Tests an already-saved project's stored (decrypted) credentials. */
export async function testProjectConnection(id: string): Promise<ConnectionTestResult> {
  const withSecret = await getProjectWithSecret(id);
  if (!withSecret) {
    return { ok: false, message: "Project not found" };
  }

  return testCredentials({
    platform: withSecret.platform,
    projectKey: withSecret.projectKey,
    ctAuthUrl: withSecret.ctAuthUrl,
    ctClientId: withSecret.ctClientId,
    ctClientSecret: withSecret.ctClientSecret,
    scopes: withSecret.scopes,
    shopifyStoreDomain: withSecret.shopifyStoreDomain,
    shopifyAdminAccessToken: withSecret.shopifyAdminAccessToken,
    shopifyApiVersion: withSecret.shopifyApiVersion,
    bigcommerceStoreHash: withSecret.bigcommerceStoreHash,
    bigcommerceClientId: withSecret.bigcommerceClientId,
    bigcommerceAccessToken: withSecret.bigcommerceAccessToken,
  });
}
