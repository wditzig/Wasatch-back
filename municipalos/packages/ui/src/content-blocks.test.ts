import { describe, expect, it } from "vitest";
import { contentExcerpt, isSafeHref } from "./content-blocks";

describe("isSafeHref", () => {
  it("allows https, mailto, tel and site-relative links only", () => {
    expect(isSafeHref("https://example.gov")).toBe(true);
    expect(isSafeHref("mailto:a@example.gov")).toBe(true);
    expect(isSafeHref("tel:+14355550100")).toBe(true);
    expect(isSafeHref("/cedar-ridge/report")).toBe(true);
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.example",
      "/\\evil.example",
      "http://example.gov",
      " https://x",
    ]) {
      expect(isSafeHref(bad), bad).toBe(false);
    }
  });
});

describe("contentExcerpt", () => {
  it("uses the first text block, flattened and truncated", () => {
    expect(
      contentExcerpt([
        { type: "heading", id: "a", text: "Hi", level: 2 },
        { type: "text", id: "b", text: "Line one.\n\nLine two." },
      ]),
    ).toBe("Line one. Line two.");
    expect(contentExcerpt([{ type: "text", id: "b", text: "x".repeat(400) }])!.length).toBe(155);
    expect(contentExcerpt([{ type: "service_links", id: "c" }])).toBeUndefined();
  });
});
