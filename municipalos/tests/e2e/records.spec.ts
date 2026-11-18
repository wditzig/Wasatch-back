import { expect, test, type Browser, type Page } from "@playwright/test";
import { PASSWORD, STAFF, expectNoA11yViolations } from "./helpers";

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${STAFF}/login`);
  await expect(page.getByText("government information system")).toBeVisible();
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

async function openRequest(page: Page, reference: string) {
  await page.goto(`${STAFF}/cedar-ridge/requests?status=all&q=${reference}`);
  await page.getByRole("link", { name: reference }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(reference);
}

test("records officer: retention schedule, legal hold, disposition and exports", async ({
  browser,
}) => {
  const clerk = await signIn(browser, "helen.cho@cedarridge.example");

  // Retention schedule.
  await clerk.goto(`${STAFF}/cedar-ridge/admin/records`);
  await expect(clerk.getByRole("heading", { level: 1, name: "Records" })).toBeVisible();
  await clerk.getByLabel(/Keep closed service requests for/).fill("1");
  await clerk.getByLabel("Keep permanently").uncheck();
  await clerk
    .getByLabel("Legal authority")
    .fill("Synthetic schedule GS-01, item 4 (demonstration)");
  await clerk.getByRole("button", { name: "Save schedule" }).click();
  await expect(clerk.getByText("Retention schedule saved.")).toBeVisible();
  await expectNoA11yViolations(clerk, "records administration");

  // Export the complete record.
  await openRequest(clerk, "CR-SAMP0007");
  const [record] = await Promise.all([
    clerk.waitForEvent("download"),
    clerk.getByRole("link", { name: "Export record" }).click(),
  ]);
  expect(record.suggestedFilename()).toBe("CR-SAMP0007.json");

  // Legal hold: place, see the banner, release.
  await clerk.getByLabel("Reason for the hold").fill("E2E: claim filed, matter 2026-E2E.");
  await clerk.getByRole("button", { name: "Place legal hold" }).click();
  await expect(clerk.getByText("This record is on legal hold.")).toBeVisible();
  await expectNoA11yViolations(clerk, "request detail with legal hold");
  await clerk.getByLabel("Release note").first().fill("E2E: matter closed.");
  await clerk.getByRole("button", { name: "Release hold" }).first().click();
  await expect(clerk.getByText("This record is on legal hold.")).toHaveCount(0);

  // Disposition of a record past its retention period (seeded CR-SAMP0009, closed long ago).
  await clerk.goto(`${STAFF}/cedar-ridge/admin/records`);
  const candidate = clerk.getByLabel(/CR-SAMP0009/);
  if (await candidate.count()) {
    await candidate.check();
    await clerk.getByRole("button", { name: "Disposition selected records" }).click();
    await expect(clerk.getByText("Confirm that you are authorized")).toBeVisible(); // refused without confirmation
    await clerk.getByLabel(/CR-SAMP0009/).check();
    await clerk.getByLabel(/I am authorized/).check();
    await clerk.getByRole("button", { name: "Disposition selected records" }).click();
    await expect(clerk.getByText("1 record dispositioned")).toBeVisible();
  }
  await openRequest(clerk, "CR-SAMP0009");
  await expect(clerk.getByText("This record has been dispositioned.")).toBeVisible();
  await expect(clerk.getByText("dale.archer@residents.example")).toHaveCount(0);
  await expect(clerk.getByText("Record dispositioned")).toBeVisible();
  await clerk.context().close();

  // Audit log export.
  const auditor = await signIn(browser, "avery.stone@cedarridge.example");
  await auditor.goto(`${STAFF}/cedar-ridge/audit`);
  const [csv] = await Promise.all([
    auditor.waitForEvent("download"),
    auditor.getByRole("link", { name: "Export CSV" }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/^audit-log-cedar-ridge-\d{4}-\d{2}-\d{2}\.csv$/);
  // Auditors can export records but cannot manage retention or holds.
  await openRequest(auditor, "CR-SAMP0007");
  await expect(auditor.getByRole("link", { name: "Export record" })).toBeVisible();
  await expect(auditor.getByRole("button", { name: "Place legal hold" })).toHaveCount(0);
  expect((await auditor.goto(`${STAFF}/cedar-ridge/admin/records`))?.status()).toBe(404);
  await auditor.context().close();

  // Department staff have neither.
  const tech = await signIn(browser, "priya.nair@cedarridge.example");
  await openRequest(tech, "CR-SAMP0003");
  await expect(tech.getByRole("link", { name: "Export record" })).toHaveCount(0);
  expect(
    (
      await tech.goto(`${STAFF}/cedar-ridge/requests/00000000-0000-4000-8000-000000000000/export`)
    )?.status(),
  ).toBe(404);
  await tech.context().close();
});
