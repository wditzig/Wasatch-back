import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Override to run the suite against servers on other ports (e.g. a second local stack).
export const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
export const STAFF = process.env.E2E_STAFF_URL ?? "http://localhost:3001";
export const PASSWORD = "municipalos-dev-password";

/**
 * Automated WCAG 2.2 A/AA scan. Passing this is necessary, not sufficient: see
 * docs/TESTING.md for the manual checks automated tools cannot perform.
 */
export async function expectNoA11yViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // The Next.js development overlay is not part of the product.
    .exclude("nextjs-portal")
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary, `accessibility violations on ${context}`).toEqual([]);
}
