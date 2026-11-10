import { expect, test } from "@playwright/test";
import { SITE, expectNoA11yViolations } from "./helpers";

test.describe("municipal website", () => {
  test("each city gets its own branded site from the same application", async ({ page }) => {
    await page.goto(SITE);
    await expect(page.getByRole("heading", { level: 1, name: "Choose your city" })).toBeVisible();
    await page.getByRole("link", { name: /Marlow Springs/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome to Marlow Springs" }),
    ).toBeVisible();
    await expect(page.getByText("Small town. Open doors.")).toBeVisible();
    const marlow = await page
      .locator("header")
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.goto(`${SITE}/cedar-ridge`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome to Cedar Ridge" }),
    ).toBeVisible();
    await expect(page.getByText("Spring street sweeping begins April 14")).toBeVisible();
    const cedar = await page
      .locator("header")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(cedar).not.toBe(marlow);

    // Graffiti is configured for Cedar Ridge only.
    await page.goto(`${SITE}/cedar-ridge/services`);
    await expect(page.getByRole("link", { name: /Graffiti/ })).toBeVisible();
    await page.goto(`${SITE}/marlow-springs/services`);
    await expect(page.getByRole("link", { name: /Pothole/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Graffiti/ })).toHaveCount(0);
  });

  test("unknown cities and tracking numbers return 404, not another city's data", async ({
    page,
  }) => {
    expect((await page.goto(`${SITE}/atlantis`))?.status()).toBe(404);
    expect((await page.goto(`${SITE}/marlow-springs/requests/CR-SAMP0001`))?.status()).toBe(404);
    expect((await page.goto(`${SITE}/cedar-ridge/requests/CR-SAMP0001`))?.status()).toBe(200);
  });

  test("report form explains errors, keeps input and suggests a category", async ({ page }) => {
    await page.goto(`${SITE}/cedar-ridge/report`);
    await expect(page.getByText("For emergencies, call 911.").first()).toBeVisible();

    await page
      .getByLabel("Describe the problem")
      .fill("The streetlight on our corner keeps flickering all night");
    await page.getByRole("button", { name: "Use Streetlight" }).click();
    await expect(page.getByRole("radio", { name: /Streetlight/ })).toBeChecked();

    await page.getByRole("button", { name: "Send request" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "Please fix the following" });
    await expect(summary).toBeVisible();
    await expect(page.getByLabel("Where is it?")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Describe the problem")).toHaveValue(/flickering/);
    await expectNoA11yViolations(page, "report form with errors");

    await page
      .getByLabel("Describe the problem")
      .fill("There is smoke and a fire near the road sign");
    await expect(page.getByText("If this is an emergency, call 911 now.")).toBeVisible();
  });

  test("tracking lookup rejects unknown numbers with a clear message", async ({ page }) => {
    await page.goto(`${SITE}/cedar-ridge/requests`);
    await page.getByLabel("Tracking number").fill("CR-00000000");
    await page.getByRole("button", { name: "Find my request" }).click();
    await expect(page.getByText(/couldn’t find a request/)).toBeVisible();
    await page.getByLabel("Tracking number").fill("cr-samp0004");
    await page.getByRole("button", { name: "Find my request" }).click();
    await expect(page).toHaveURL(/\/cedar-ridge\/requests\/CR-SAMP0004$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Damaged or missing sign");
  });

  for (const path of [
    "/",
    "/cedar-ridge",
    "/cedar-ridge/services",
    "/cedar-ridge/report",
    "/cedar-ridge/requests",
    "/cedar-ridge/requests/CR-SAMP0004",
    "/cedar-ridge/departments",
    "/marlow-springs",
  ]) {
    test(`no automated accessibility violations on ${path}`, async ({ page }) => {
      await page.goto(`${SITE}${path}`);
      await expectNoA11yViolations(page, path);
    });
  }

  test("report form is usable with the keyboard alone", async ({ page }) => {
    await page.goto(`${SITE}/cedar-ridge/report`);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.getByRole("radio", { name: /Pothole/ }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: /Pothole/ })).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /Streetlight/ })).toBeChecked();
  });

  test("layout has no horizontal scrolling on a phone", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    for (const path of [
      "/cedar-ridge",
      "/cedar-ridge/report",
      "/cedar-ridge/requests/CR-SAMP0004",
    ]) {
      await page.goto(`${SITE}${path}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await context.close();
  });
});
