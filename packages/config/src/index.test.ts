import { describe, it, expect, afterEach } from "vitest";
import { env, requiredEnv, envInt } from "./index.js";

const KEY = "CSA_TEST_ENV_VAR_UNIQUE";

describe("@csa/config env helpers", () => {
  afterEach(() => {
    delete process.env[KEY];
  });

  it("env trims and returns the value, or undefined when unset/empty", () => {
    expect(env(KEY)).toBeUndefined();
    process.env[KEY] = "  hello  ";
    expect(env(KEY)).toBe("hello");
    process.env[KEY] = "   ";
    expect(env(KEY)).toBeUndefined();
  });

  it("requiredEnv returns the value and throws when missing", () => {
    process.env[KEY] = "v";
    expect(requiredEnv(KEY)).toBe("v");
    delete process.env[KEY];
    expect(() => requiredEnv(KEY)).toThrow(/Missing required environment variable/);
  });

  it("envInt parses positive ints and falls back on unset/invalid/non-positive", () => {
    expect(envInt(KEY, 42)).toBe(42); // unset
    process.env[KEY] = "7";
    expect(envInt(KEY, 42)).toBe(7);
    process.env[KEY] = "notanumber";
    expect(envInt(KEY, 42)).toBe(42);
    process.env[KEY] = "0";
    expect(envInt(KEY, 42)).toBe(42); // not > 0
    process.env[KEY] = "-5";
    expect(envInt(KEY, 42)).toBe(42);
  });
});
