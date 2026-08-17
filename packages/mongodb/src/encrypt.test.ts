import { describe, it, expect } from "vitest";
import { encrypt, decrypt, decryptWithFallback } from "./encrypt.js";

// These run with SUPERADMIN_ENCRYPTION_KEY unset + NODE_ENV=test, so encrypt/
// decrypt use the labeled dev-default key (never the prod path) — the round-trip
// is deterministic regardless of key source.
describe("@csa/mongodb encrypt", () => {
  it("encrypt → decrypt round-trips a secret", () => {
    const secret = "super-secret-value-123";
    const ciphertext = encrypt(secret);
    expect(ciphertext).not.toBe(secret);
    expect(ciphertext.split(":")).toHaveLength(3); // iv:authTag:data
    expect(decrypt(ciphertext)).toBe(secret);
  });

  it("produces a different iv/ciphertext each call for the same plaintext", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("decrypt throws on a malformed ciphertext", () => {
    expect(() => decrypt("not-a-valid-ciphertext")).toThrow();
  });

  it("decryptWithFallback returns legacy plaintext verbatim, but decrypts real ciphertext", () => {
    // legacy plaintext (not iv:tag:data) → returned as-is
    expect(decryptWithFallback("legacy-plaintext-secret")).toBe("legacy-plaintext-secret");
    // real ciphertext → decrypted
    const ct = encrypt("newly-encrypted");
    expect(decryptWithFallback(ct)).toBe("newly-encrypted");
    // empty → empty
    expect(decryptWithFallback("")).toBe("");
  });
});
