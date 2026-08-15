/**
 * Validates GraphQL mutation input for `ssoConfig` and merges with existing
 * OIDC/SAML secrets when the caller leaves a secret field blank on edit.
 */

import { decryptSsoSecret } from "./sso-secrets.js";
import type { CsaClient, ClientSsoConfigStored } from "./types.js";

export function parseClientSsoConfigInput(
  raw: unknown,
  existing: CsaClient | null
): { ok: true; value: ClientSsoConfigStored } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: false, error: "ssoConfig payload is missing" };
  }
  if (raw === null) {
    return { ok: true, value: { provider: "none" } };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "ssoConfig must be an object" };
  }

  const obj = raw as Record<string, unknown>;
  const provider = obj.provider;

  if (provider === "none" || provider === undefined) {
    return { ok: true, value: { provider: "none" } };
  }

  if (provider === "oidc") {
    const issuer = typeof obj.issuer === "string" ? obj.issuer.trim() : "";
    const clientId = typeof obj.clientId === "string" ? obj.clientId.trim() : "";
    const secretIn = typeof obj.oidcClientSecret === "string" ? obj.oidcClientSecret : "";
    const providerDisplayName = typeof obj.providerDisplayName === "string" ? obj.providerDisplayName.trim() : undefined;
    const extraScopes = typeof obj.extraScopes === "string" ? obj.extraScopes.trim() : undefined;
    const authorizeConnectionRaw = typeof obj.authorizeConnection === "string" ? obj.authorizeConnection.trim() : "";
    const authorizeConnection = authorizeConnectionRaw.length > 0 ? authorizeConnectionRaw : undefined;

    if (!issuer || !/^https?:\/\//i.test(issuer)) {
      return { ok: false, error: "OIDC issuer must be a valid http(s) URL" };
    }
    if (!clientId) {
      return { ok: false, error: "OIDC client ID is required" };
    }

    // The stored secret is encrypted at rest — decrypt it (plaintext fallback
    // for legacy records) so the merged value flowing on to the write boundary
    // is always plaintext, and gets re-encrypted exactly once there.
    const prev = existing?.ssoConfig?.provider === "oidc" ? decryptSsoSecret(existing.ssoConfig.clientSecret).trim() : "";

    let clientSecret = secretIn.trim();
    if (!clientSecret) {
      if (!prev) {
        return { ok: false, error: "OIDC client secret is required on first save" };
      }
      clientSecret = prev;
    }

    if (authorizeConnection !== undefined && authorizeConnection.length > 128) {
      return { ok: false, error: "OAuth connection name must be at most 128 characters" };
    }
    if (authorizeConnection !== undefined && !/^[a-zA-Z0-9_.\- ]+$/.test(authorizeConnection)) {
      return {
        ok: false,
        error: "OAuth connection name contains invalid characters (use letters, numbers, spaces, . _ -)",
      };
    }

    return {
      ok: true,
      value: {
        provider: "oidc",
        issuer,
        clientId,
        clientSecret,
        providerDisplayName: providerDisplayName || undefined,
        extraScopes: extraScopes || undefined,
        authorizeConnection,
      },
    };
  }

  if (provider === "saml") {
    const entryPointUrl = typeof obj.entryPointUrl === "string" ? obj.entryPointUrl.trim() : "";
    const issuer = typeof obj.issuer === "string" ? obj.issuer.trim() : "";
    const certIn = typeof obj.idpCertPem === "string" ? obj.idpCertPem : "";
    const certTrim = certIn.trim();

    if (!entryPointUrl || !/^https?:\/\//i.test(entryPointUrl)) {
      return { ok: false, error: "SAML entry point must be a valid http(s) URL" };
    }
    if (!issuer) {
      return { ok: false, error: "SAML issuer / entity ID is required" };
    }

    // Decrypt the stored cert (plaintext fallback for legacy records) so the
    // merged value stays plaintext up to the single encrypt boundary on write.
    const prevCert = existing?.ssoConfig?.provider === "saml" ? decryptSsoSecret(existing.ssoConfig.idpCertPem).trim() : "";
    let idpCertPem = certTrim;
    if (!idpCertPem) {
      if (!prevCert) {
        return { ok: false, error: "SAML IdP certificate (PEM) is required on first save" };
      }
      idpCertPem = prevCert;
    }

    return { ok: true, value: { provider: "saml", entryPointUrl, issuer, idpCertPem } };
  }

  return { ok: false, error: "ssoConfig.provider must be none, oidc, or saml" };
}
