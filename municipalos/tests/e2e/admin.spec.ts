import { expect, test, type Browser, type Page } from "@playwright/test";
import { PASSWORD, SITE, STAFF, expectNoA11yViolations } from "./helpers";

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${STAFF}/login`);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

test("an administrator adds a category and residents can use it straight away", async ({
  browser,
  page,
}) => {
  const name = `Storm drain ${Date.now()}`;
  const admin = await signIn(browser, "dana.whitaker@cedarridge.example");
  await admin.getByRole("link", { name: "Administration" }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Request categories" })).toBeVisible();
  await expectNoA11yViolations(admin, "admin categories");

  // Validation errors come back on the form.
  await admin.getByLabel("Name").fill(name);
  await admin.getByLabel("Responsible department").selectOption({ label: "Public Works" });
  await admin.getByLabel("Suggestion keywords").fill("<bad>");
  await admin.getByRole("button", { name: "Add category" }).click();
  await expect(
    admin.getByRole("alert").filter({ hasText: "Please fix the highlighted fields." }),
  ).toBeVisible();

  await admin.getByLabel("Name").fill(name);
  await admin.getByLabel("Responsible department").selectOption({ label: "Public Works" });
  await admin.getByLabel("Suggestion keywords").fill("storm drain, clogged drain");
  await admin.getByRole("button", { name: "Add category" }).click();
  await expect(admin.getByText(`“${name}” was added.`)).toBeVisible();

  await page.goto(`${SITE}/cedar-ridge/services`);
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await page.goto(`${SITE}/marlow-springs/services`);
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);

  // Deactivate it again: it disappears for residents.
  await admin.getByRole("link", { name: `Edit ${name}` }).click();
  await admin.getByLabel("Active").uncheck();
  await admin.getByRole("button", { name: "Save category" }).click();
  await expect(admin.getByText("Category saved.")).toBeVisible();
  await page.goto(`${SITE}/cedar-ridge/services`);
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  await admin.context().close();
});

test("city settings change the public website", async ({ browser, page }) => {
  const admin = await signIn(browser, "dana.whitaker@cedarridge.example");
  await admin.goto(`${STAFF}/cedar-ridge/admin/settings`);
  await expectNoA11yViolations(admin, "admin settings");
  const original = await admin.getByLabel("Tagline").inputValue();
  const tagline = `Tagline ${Date.now()}`;
  await admin.getByLabel("Tagline").fill(tagline);
  await admin.getByRole("button", { name: "Save settings" }).click();
  await expect(admin.getByText("Settings saved.")).toBeVisible();
  await page.goto(`${SITE}/cedar-ridge`);
  await expect(page.getByText(tagline)).toBeVisible();

  await admin.getByLabel("Tagline").fill(original);
  await admin.getByRole("button", { name: "Save settings" }).click();
  await expect(admin.getByText("Settings saved.")).toBeVisible();
  await admin.context().close();
});

test("staff access: review list, change a role, and no self-service or unauthorised access", async ({
  browser,
}) => {
  const admin = await signIn(browser, "dana.whitaker@cedarridge.example");
  await admin.goto(`${STAFF}/cedar-ridge/admin/staff`);
  await expect(admin.getByText("You cannot change your own access")).toBeVisible();
  await expectNoA11yViolations(admin, "admin staff access");

  await admin.getByRole("link", { name: "Change access for Tom Becker" }).click();
  await admin.getByLabel("Job title").fill("Parks Supervisor II");
  await admin.getByRole("button", { name: "Save access" }).click();
  await expect(admin.getByText("Access saved.")).toBeVisible();
  await expect(admin.getByText(/Parks Supervisor II/)).toBeVisible();
  await admin.getByRole("link", { name: "Change access for Tom Becker" }).click();
  await admin.getByLabel("Job title").fill("Parks Supervisor");
  await admin.getByRole("button", { name: "Save access" }).click();
  await expect(admin.getByText("Access saved.")).toBeVisible();
  await admin.context().close();

  // A technician has no administration area at all.
  const tech = await signIn(browser, "priya.nair@cedarridge.example");
  await expect(tech.getByRole("link", { name: "Administration" })).toHaveCount(0);
  for (const path of ["admin", "admin/categories", "admin/staff", "admin/settings"]) {
    expect((await tech.goto(`${STAFF}/cedar-ridge/${path}`))?.status(), path).toBe(404);
  }
  await tech.context().close();

  // An auditor may review access but not change it.
  const auditor = await signIn(browser, "avery.stone@cedarridge.example");
  await auditor.goto(`${STAFF}/cedar-ridge/admin/staff`);
  await expect(auditor.getByRole("heading", { level: 1, name: "Staff access" })).toBeVisible();
  await expect(auditor.getByRole("link", { name: /Change access/ })).toHaveCount(0);
  expect((await auditor.goto(`${STAFF}/cedar-ridge/admin/settings`))?.status()).toBe(404);
  await auditor.context().close();
});
