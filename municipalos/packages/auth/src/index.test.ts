import { describe, expect, it } from "vitest";
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./index";

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("salts hashes", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });
  it("rejects missing or malformed stored hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "plaintext")).toBe(false);
  });
});

describe("session tokens", () => {
  it("are unique and stored only as digests", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(a)).not.toContain(a);
  });
});
