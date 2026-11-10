import { describe, expect, it } from "vitest";
import { cityColors, contrastRatio } from "./color";

describe("cityColors", () => {
  it("picks white text on dark brand colours and dark text on light ones", () => {
    expect(cityColors("#1f5f8b").onPrimary).toBe("#ffffff");
    expect(cityColors("#ffd54f").onPrimary).toBe("#0f172a");
  });
  it("always yields at least AA contrast for normal text", () => {
    for (const c of [
      "#1f5f8b",
      "#2f6b4f",
      "#ffd54f",
      "#777777",
      "#ff0000",
      "#00ff00",
      "#808080",
      "#ff00ff",
      "#0000ff",
      "#ffffff",
      "#000000",
    ]) {
      const { primary, onPrimary } = cityColors(c);
      expect(contrastRatio(primary, onPrimary)!, c).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("leaves compliant colours untouched and darkens mid-tones that cannot comply", () => {
    expect(cityColors("#1f5f8b").primary).toBe("#1f5f8b");
    expect(cityColors("#ff0000").primary).not.toBe("#ff0000");
  });
  it("falls back to the default for invalid values (no CSS injection)", () => {
    expect(cityColors("red; background:url(x)").primary).toBe("#4353c9");
    expect(cityColors(undefined).primary).toBe("#4353c9");
  });
});
