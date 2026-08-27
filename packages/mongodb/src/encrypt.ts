/**
 * AES-256-GCM encryption helpers for storing sensitive credentials in MongoDB
 * (CT/Shopify/BigCommerce client secrets, OIDC client secrets, SMTP passwords).
 *
 * Ported verbatim from ct-csa-standalone's lib/encrypt.ts.
 *
 * Encrypted values are stored as: `${iv_hex}:${authTag_hex}:${ciphertext_hex}`
 *
 * Key source (in order):
 *   1. SUPERADMIN_ENCRYPTION_KEY env var — 64-char hex (32 bytes) or any string
 *      (padded/truncated to 32 bytes with UTF-8 encoding).
 *   2. Insecure dev default when NODE_ENV !== 'production' — logs a warning.
 *
 * @throws {Error} In production when SUPERADMIN_ENCRYPTION_KEY is not set.
 */

import crypto from 'crypto';
import { noopLogger, type InjectedLogger } from './observability.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 16;

/**
 * Derives a 32-byte Buffer key from the SUPERADMIN_ENCRYPTION_KEY env var.
 * Accepts a 64-char hex string (preferred) or any UTF-8 string (padded to 32 bytes).
 */
function getKey(logger: InjectedLogger = noopLogger): Buffer {
  const keyStr = process.env.SUPERADMIN_ENCRYPTION_KEY?.trim();

  if (!keyStr) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[encrypt] SUPERADMIN_ENCRYPTION_KEY must be set in production. ' +
          'Generate with: openssl rand -hex 32'
      );
    }
    // Dev fallback — intentionally weak and clearly labeled.
    logger.warn(
      'SUPERADMIN_ENCRYPTION_KEY is not set — using insecure development default; set it before production'
    );
    return Buffer.alloc(32, 'dev-default-not-for-production-!');
  }

  // 64-char hex → 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(keyStr)) {
    return Buffer.from(keyStr, 'hex');
  }

  // Arbitrary string → pad / truncate to 32 bytes
  const buf = Buffer.alloc(32);
  const src = Buffer.from(keyStr, 'utf8');
  src.copy(buf, 0, 0, Math.min(src.length, 32));
  return buf;
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a portable string: `iv:authTag:ciphertext` (all hex).
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in `iv:authTag:ciphertext` format
 */
export function encrypt(plaintext: string, logger: InjectedLogger = noopLogger): string {
  const key = getKey(logger);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypts a string produced by `encrypt()`.
 *
 * @param ciphertext - The `iv:authTag:ciphertext` hex string
 * @returns Original plaintext
 * @throws {Error} If the format is invalid or authentication fails
 */
export function decrypt(ciphertext: string, logger: InjectedLogger = noopLogger): string {
  const key = getKey(logger);
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error('[encrypt] Invalid ciphertext format — expected iv:authTag:data');
  }

  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Decrypts a value produced by {@link encrypt}, falling back to the RAW value
 * when it isn't in ciphertext form (bad format, or GCM auth failure).
 *
 * This is the read path for fields that were historically stored in PLAINTEXT
 * and are only now being encrypted on write (e.g. SSO OIDC client secrets and
 * SAML IdP certs). Existing legacy records don't match the `iv:tag:data` shape,
 * so `decrypt()` throws — here we return them verbatim so those records keep
 * working, while newly-written encrypted values round-trip normally. Never use
 * this for a field that is guaranteed-encrypted; use {@link decrypt} there so a
 * genuine tampering/format error surfaces instead of being silently swallowed.
 */
export function decryptWithFallback(value: string, logger: InjectedLogger = noopLogger): string {
  if (!value) return value;
  try {
    return decrypt(value, logger);
  } catch {
    return value;
  }
}
