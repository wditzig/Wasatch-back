/**
 * The milestone-1 vertical slice through the real UI:
 * resident reports -> department triages and assigns -> technician resolves -> resident sees it.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { PASSWORD, SITE, STAFF, expectNoA11yViolations } from "./helpers";

async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${STAFF}/login`);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

async function openRequest(page: Page, city: string, reference: string) {
  await page.goto(`${STAFF}/${city}/requests?status=all&q=${reference}`);
  await page.getByRole("link", { name: reference }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(reference);
}

test("resident reports a pothole, staff resolve it, resident sees the outcome", async ({
  browser,
  page,
}) => {
  const location = `E2E ${Date.now()} Orchard Ave`;

  // ── Resident: choose city, find the service, submit ──
  await page.goto(SITE);
  await page.getByRole("link", { name: /Cedar Ridge/ }).click();
  await page.getByRole("link", { name: "Services", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "City services" })).toBeVisible();
  await page.getByRole("link", { name: /^Pothole/ }).click();
  await expect(page.getByRole("radio", { name: /Pothole/ })).toBeChecked();
  await page
    .getByLabel("Describe the problem")
    .fill("Wide pothole in the eastbound lane, about a foot across.");
  await page.getByLabel("Where is it?").fill(location);
  await page.getByLabel("Email").fill("e2e.resident@residents.example");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByText("Thank you. Your request was sent.")).toBeVisible();
  const reference = (await page.url().match(/requests\/(CR-[0-9A-Z]{8})/))![1]!;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pothole");
  await expect(page.locator('[aria-current="step"]')).toContainText("New");
  const trackingUrl = `${SITE}/cedar-ridge/requests/${reference}`;

  // ── Parks staff never see a Public Works request ──
  const parks = await signIn(browser, "tom.becker@cedarridge.example");
  await parks.goto(`${STAFF}/cedar-ridge/requests?status=all&q=${reference}`);
  await expect(parks.getByRole("link", { name: reference })).toHaveCount(0);
  await parks.context().close();

  // ── Public Works director: sees it routed to the department, reviews, assigns ──
  const director = await signIn(browser, "luis.ortega@cedarridge.example");
  await expect(director.getByRole("heading", { level: 1 })).toContainText("Welcome, Luis");
  await expect(director.getByText(location)).toBeVisible(); // in "Needs triage"
  await openRequest(director, "cedar-ridge", reference);
  await expect(director.getByText("e2e.resident@residents.example")).toBeVisible();
  await director.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(director.getByText(/New to Reviewed/)).toBeVisible();
  await director
    .getByLabel("Assign to")
    .selectOption({ label: "Priya Nair — Streets Maintenance Technician" });
  await director.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(director.getByText(/Reviewed to Assigned/)).toBeVisible();
  await director.getByLabel("Note or message").fill("E2E internal: third report on this block.");
  await director.getByRole("button", { name: "Add", exact: true }).click();
  await expect(director.getByText("E2E internal: third report on this block.")).toBeVisible();
  await expectNoA11yViolations(director, "staff request detail");
  await director.context().close();

  // ── Resident sees progress but not the internal note ──
  await page.goto(trackingUrl);
  await expect(page.locator('[aria-current="step"]')).toContainText("Assigned");
  await expect(page.getByText("E2E internal")).toHaveCount(0);
  await expect(page.getByText("Priya")).toHaveCount(0);

  // ── Technician: notified, works it, resolves with a note to the resident ──
  const tech = await signIn(browser, "priya.nair@cedarridge.example");
  await expect(tech.getByText(location)).toBeVisible(); // in "Assigned to me"
  await tech.goto(`${STAFF}/cedar-ridge/notifications`);
  await expect(tech.getByText(`${reference} was assigned to you`)).toBeVisible();
  await openRequest(tech, "cedar-ridge", reference);
  await expect(tech.getByRole("button", { name: "Assign", exact: true })).toHaveCount(0);
  await tech.getByRole("button", { name: "Start work" }).click();
  await expect(tech.getByText(/Assigned to In progress/)).toBeVisible();
  await tech.getByLabel(/Note to resident/).fill("Patched with hot mix. Thanks for reporting it.");
  await tech.getByRole("button", { name: "Mark resolved" }).click();
  await expect(tech.getByText(/In progress to Resolved/)).toBeVisible();
  await tech.context().close();

  // ── Resident receives the update ──
  await page.goto(trackingUrl);
  await expect(page.locator('[aria-current="step"]')).toContainText("Resolved");
  await expect(page.getByText("Status changed to Resolved")).toBeVisible();
  await expect(page.getByText("Patched with hot mix. Thanks for reporting it.")).toBeVisible();

  // ── Auditor: complete trail, read-only ──
  const auditor = await signIn(browser, "avery.stone@cedarridge.example");
  await auditor.goto(`${STAFF}/cedar-ridge/audit`);
  await expect(auditor.getByText("service_request.status_changed").first()).toBeVisible();
  await expect(auditor.getByText("service_request.assigned").first()).toBeVisible();
  await openRequest(auditor, "cedar-ridge", reference);
  await expect(auditor.getByRole("button", { name: /Close|Reopen|Assign|Add/ })).toHaveCount(0);
  await auditor.context().close();
});

test("staff of one city cannot open another city's dashboard or records", async ({ browser }) => {
  const outsider = await signIn(browser, "grace.okafor@marlowsprings.example");
  await expect(outsider).toHaveURL(`${STAFF}/marlow-springs`);
  expect((await outsider.goto(`${STAFF}/cedar-ridge`))?.status()).toBe(404);
  expect((await outsider.goto(`${STAFF}/cedar-ridge/requests`))?.status()).toBe(404);
  expect((await outsider.goto(`${STAFF}/cedar-ridge/audit`))?.status()).toBe(404);
  await outsider.goto(`${STAFF}/marlow-springs/requests?status=all`);
  await expect(outsider.getByText(/CR-/)).toHaveCount(0);
  await expect(outsider.getByRole("link", { name: /MS-/ }).first()).toBeVisible();
  await outsider.context().close();
});

test("signed-out visitors are sent to sign in; bad credentials are rejected", async ({ page }) => {
  await page.goto(`${STAFF}/cedar-ridge/requests`);
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Work email").fill("luis.ortega@cedarridge.example");
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "email or password is incorrect" }),
  ).toBeVisible();
  await expectNoA11yViolations(page, "staff login with error");
});

test("staff pages have no automated accessibility violations", async ({ browser }) => {
  const admin = await signIn(browser, "dana.whitaker@cedarridge.example");
  for (const path of ["", "/requests", "/requests?status=all", "/notifications", "/audit"]) {
    await admin.goto(`${STAFF}/cedar-ridge${path}`);
    await expectNoA11yViolations(admin, `staff ${path || "dashboard"}`);
  }
  await admin.setViewportSize({ width: 390, height: 800 });
  await admin.goto(`${STAFF}/cedar-ridge`);
  await expectNoA11yViolations(admin, "staff dashboard (mobile)");
  await admin.context().close();
});
