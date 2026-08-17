/**
 * Encryption at rest for client SSO secrets.
 *
 * `ssoConfig` carries two genuinely-sensitive fields — the OIDC `clientSecret`
 * and the SAML `idpCertPem` — which were previously persisted to MongoDB in
 * PLAINTEXT. These helpers encrypt them on WRITE (AES-256-GCM, the same key as
 * commerce credentials) and decrypt them on READ with a plaintext fallback, so
 * existing legacy (unencrypted) records keep working after the change.
 *
 * The in-memory `ClientSsoConfigStored` contract stays "plaintext secrets"
 * everywhere in the app; encryption is applied only at the repository write
 * boundary and reversed only by the internal read helper below.
 */

import { encrypt, decryptWithFallback } from "../encrypt.js";
import type { ClientSsoConfigStored } from "./types.js";

/**
 * Decrypts a single stored SSO secret, returning legacy plaintext verbatim.
 * Thin wrapper over {@link decryptWithFallback} for call-site clarity.
 */
export function decryptSsoSecret(value: string): string {
  return decryptWithFallback(value);
}

/**
 * Returns a copy of `cfg` with its secret fields ENCRYPTED (OIDC `clientSecret`
 * / SAML `idpCertPem`). Non-secret fields and the `none` provider pass through
 * unchanged. Apply this at the write boundary; the input is expected to hold
 * plaintext secrets. An empty secret is left as-is (nothing to encrypt).
 */
export function encryptSsoConfigSecrets(cfg: ClientSsoConfigStored): ClientSsoConfigStored {
  if (cfg.provider === "oidc") {
    return { ...cfg, clientSecret: cfg.clientSecret ? encrypt(cfg.clientSecret) : cfg.clientSecret };
  }
  if (cfg.provider === "saml") {
    return { ...cfg, idpCertPem: cfg.idpCertPem ? encrypt(cfg.idpCertPem) : cfg.idpCertPem };
  }
  return cfg;
}

/**
 * Returns a copy of `cfg` with its secret fields DECRYPTED (plaintext fallback
 * for legacy records). For internal consumers that need the real secret to
 * drive an SSO login — analogous to `getProjectWithSecret` for commerce creds.
 * Never expose the result over the API; the masked `ssoConfigView` is the
 * public projection.
 */
export function decryptSsoConfigSecrets(cfg: ClientSsoConfigStored): ClientSsoConfigStored {
  if (cfg.provider === "oidc") {
    return { ...cfg, clientSecret: decryptSsoSecret(cfg.clientSecret) };
  }
  if (cfg.provider === "saml") {
    return { ...cfg, idpCertPem: decryptSsoSecret(cfg.idpCertPem) };
  }
  return cfg;
}
