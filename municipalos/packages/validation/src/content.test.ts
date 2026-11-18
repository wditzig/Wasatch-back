import { describe, expect, it } from "vitest";
import { contentBlocksSchema, createPageSchema, safeUrlSchema, saveDraftSchema } from "./index";

describe("safeUrlSchema", () => {
  it("accepts https, mailto, tel and site-relative links", () => {
    for (const url of [
      "https://example.gov/forms",
      "mailto:clerk@example.gov",
      "tel:+14355550100",
      "/cedar-ridge/report",
    ]) {
      expect(safeUrlSchema.safeParse(url).success, url).toBe(true);
    }
  });
  it("rejects script, data, plain-http and protocol-relative links", () => {
    for (const url of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "http://example.gov",
      "//evil.example",
      "/\\evil.example",
      "java\tscript:alert(1)",
      "ftp://example.gov",
      "example.gov",
      "",
    ]) {
      expect(safeUrlSchema.safeParse(url).success, url).toBe(false);
    }
  });
});

describe("contentBlocksSchema", () => {
  it("accepts each block type and normalizes blank optional fields", () => {
    const parsed = contentBlocksSchema.parse([
      { type: "heading", id: "a", text: "Hours", level: 2 },
      { type: "text", id: "b", text: "Open weekdays.\n\nClosed holidays." },
      { type: "callout", id: "c", tone: "warning", title: "", text: "Closed Monday." },
      { type: "links", id: "d", items: [{ label: "Forms", url: "https://example.gov/forms" }] },
      { type: "contact", id: "e", name: "City Clerk", email: "", phone: "(435) 555-0110" },
      { type: "service_links", id: "f" },
    ]);
    expect(parsed).toHaveLength(6);
    expect(parsed[2]).not.toHaveProperty("title", "");
    expect((parsed[4] as { email?: string }).email).toBeUndefined();
  });
  it("rejects unknown block types, unsafe links, bad heading levels and duplicate ids", () => {
    expect(
      contentBlocksSchema.safeParse([{ type: "html", id: "a", html: "<script>" }]).success,
    ).toBe(false);
    expect(
      contentBlocksSchema.safeParse([
        { type: "links", id: "a", items: [{ label: "x", url: "javascript:alert(1)" }] },
      ]).success,
    ).toBe(false);
    expect(
      contentBlocksSchema.safeParse([{ type: "heading", id: "a", text: "x", level: 1 }]).success,
    ).toBe(false);
    expect(
      contentBlocksSchema.safeParse([
        { type: "text", id: "a", text: "one" },
        { type: "text", id: "a", text: "two" },
      ]).success,
    ).toBe(false);
    expect(contentBlocksSchema.safeParse([{ type: "links", id: "a", items: [] }]).success).toBe(
      false,
    );
  });
  it("strips unknown properties from blocks", () => {
    const [block] = contentBlocksSchema.parse([
      { type: "text", id: "a", text: "hi", onClick: "evil()" },
    ]);
    expect(block).toEqual({ type: "text", id: "a", text: "hi" });
  });
});

describe("page schemas", () => {
  it("validates slugs and titles", () => {
    expect(createPageSchema.safeParse({ slug: "about-us", title: "About us" }).success).toBe(true);
    expect(createPageSchema.safeParse({ slug: "About Us", title: "About us" }).success).toBe(false);
    expect(createPageSchema.safeParse({ slug: "../admin", title: "x" }).success).toBe(false);
  });
  it("requires an explicit expected version when saving", () => {
    expect(saveDraftSchema.safeParse({ title: "About", blocks: [] }).success).toBe(false);
    expect(
      saveDraftSchema.safeParse({ title: "About", blocks: [], expectedVersion: null }).success,
    ).toBe(true);
  });
});
