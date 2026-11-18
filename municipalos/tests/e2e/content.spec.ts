/**
 * Website CMS through the real UI: an editor drafts and submits a page, a reviewer approves it,
 * and it appears on the public website and in its menu. Nothing is public before approval.
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

test("editor drafts a page, reviewer publishes it, residents see it", async ({ browser, page }) => {
  const stamp = Date.now();
  const title = `Leaf collection ${stamp}`;
  const slug = `leaf-collection-${stamp}`;
  const publicUrl = `${SITE}/cedar-ridge/p/${slug}`;

  // ── Editor: create, build with blocks, reorder, save ──
  const editor = await signIn(browser, "nora.kim@cedarridge.example");
  await editor.getByRole("link", { name: "Website" }).click();
  await expect(editor.getByRole("heading", { level: 1, name: "Website" })).toBeVisible();
  // After a client-side navigation the document title arrives with the streamed metadata.
  await expect(editor).toHaveTitle(/Website/);
  await expectNoA11yViolations(editor, "staff website pages list");
  await editor.getByRole("link", { name: "New page" }).click();
  await editor.getByLabel("Page title").fill(title);
  await expect(editor.getByLabel("Web address")).toHaveValue(slug);
  await editor.getByRole("button", { name: "Create page" }).click();
  await expect(editor.getByRole("heading", { level: 1 })).toContainText(title);

  await editor.getByRole("button", { name: "Add block" }).click();
  await editor
    .getByLabel("Text", { exact: true })
    .fill("Crews collect bagged leaves every Monday in November.");
  await editor.getByLabel("Add a block").selectOption({ label: "Heading" });
  await editor.getByRole("button", { name: "Add block" }).click();
  await editor.getByLabel("Heading text").fill("Schedule");
  // Reorder with the keyboard-operable button; focus stays on a move control.
  await editor.getByRole("button", { name: "Move Heading block 2 of 2 up" }).click();
  await expect(
    editor.getByRole("button", { name: "Move Heading block 1 of 2 down" }),
  ).toBeFocused();
  await expect(editor.getByRole("heading", { level: 3, name: "1. Heading" })).toBeVisible();

  // An unsafe link is refused with a clear message and nothing is saved.
  await editor.getByLabel("Add a block").selectOption({ label: "Link list" });
  await editor.getByRole("button", { name: "Add block" }).click();
  await editor.getByLabel("Link 1 text").fill("Click me");
  await editor.getByLabel("Link 1 address").fill("javascript:alert(1)");
  await editor.getByRole("button", { name: "Save draft" }).click();
  await expect(
    editor.getByRole("alert").filter({ hasText: "The page was not saved" }),
  ).toContainText("Block 3 (Link list)");
  await editor.getByLabel("Link 1 text").fill("Yard waste rules");
  await editor.getByLabel("Link 1 address").fill("/cedar-ridge/departments");

  await expect(editor.getByText("You have unsaved changes.")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  await editor.getByRole("button", { name: "Save draft" }).click();
  await expect(editor.getByText("Draft saved.")).toBeVisible();
  await expect(editor.getByText("All changes saved.")).toBeVisible();
  // Saving refreshes the page data; the title is briefly re-streamed while that happens.
  await expect(editor).toHaveTitle(new RegExp(title));
  await expectNoA11yViolations(editor, "staff page editor");

  // Still private.
  expect((await page.goto(publicUrl))?.status()).toBe(404);

  await editor.getByRole("button", { name: "Submit for review" }).click();
  await expect(editor.getByText("Waiting for review")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  expect((await page.goto(publicUrl))?.status()).toBe(404);
  await editor.context().close();

  // ── Reviewer: notified, sees exactly what was submitted, approves ──
  const clerk = await signIn(browser, "helen.cho@cedarridge.example");
  await clerk.goto(`${STAFF}/cedar-ridge/notifications`);
  await clerk.getByRole("link", { name: `Page "${title}" is waiting for review` }).click();
  await expect(
    clerk.getByText("Crews collect bagged leaves every Monday in November."),
  ).toBeVisible();
  await expect(clerk).toHaveTitle(new RegExp(title));
  await expectNoA11yViolations(clerk, "staff page review");
  await clerk.getByLabel("Show in the website menu").check();
  await clerk.getByRole("button", { name: "Save menu settings" }).click();
  await expect(clerk.getByText("Navigation settings saved.")).toBeVisible();
  await clerk.getByRole("button", { name: "Approve and publish" }).click();
  await expect(clerk.getByText(/Live since/)).toBeVisible();

  // ── Resident: the page is public, in the menu, and accessible ──
  await page.goto(publicUrl);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Schedule" })).toBeVisible();
  await expect(
    page.getByText("Crews collect bagged leaves every Monday in November."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Yard waste rules" })).toHaveAttribute(
    "href",
    "/cedar-ridge/departments",
  );
  await expectNoA11yViolations(page, "public CMS page");
  await page.goto(`${SITE}/cedar-ridge`);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(publicUrl);
  // Another city never serves it.
  expect((await page.goto(`${SITE}/marlow-springs/p/${slug}`))?.status()).toBe(404);

  // ── Reviewer archives it: gone from the site and the menu, history kept ──
  await clerk.getByRole("button", { name: "Archive page" }).click();
  await expect(clerk.getByText("Not on the public website.")).toBeVisible();
  await expect(clerk.getByRole("button", { name: "Restore as draft" })).toBeVisible();
  expect((await page.goto(publicUrl))?.status()).toBe(404);
  await page.goto(`${SITE}/cedar-ridge`);
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  await clerk.context().close();
});

test("seeded pages render; drafts are not public", async ({ page }) => {
  await page.goto(`${SITE}/cedar-ridge/p/about`);
  await expect(page.getByRole("heading", { level: 1, name: "About Cedar Ridge" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Report a problem" }).last()).toHaveAttribute(
    "href",
    "/cedar-ridge/report",
  );
  await expectNoA11yViolations(page, "public about page");
  expect((await page.goto(`${SITE}/cedar-ridge/p/winter-parking`))?.status()).toBe(404);
  expect((await page.goto(`${SITE}/cedar-ridge/p/..%2Fadmin`))?.status()).toBe(404);
});

test("announcements need a publisher before they reach the home page", async ({
  browser,
  page,
}) => {
  const title = `Hydrant flushing ${Date.now()}`;
  const editor = await signIn(browser, "nora.kim@cedarridge.example");
  await editor.goto(`${STAFF}/cedar-ridge/content/announcements`);
  // The "new announcement" form; existing drafts have their own edit forms on this page.
  await editor.locator("#new-title").fill(title);
  await editor.locator("#new-body").fill("Crews will flush hydrants on the east side this week.");
  await editor.getByRole("button", { name: "Save as draft" }).click();
  await expect(editor.getByRole("heading", { level: 2, name: title })).toBeVisible();
  await expect(editor.getByText("Waiting for a reviewer to publish.").first()).toBeVisible();
  await expect(editor.getByRole("button", { name: `Publish announcement: ${title}` })).toHaveCount(
    0,
  );
  await expectNoA11yViolations(editor, "staff announcements (editor)");
  await editor.context().close();

  await page.goto(`${SITE}/cedar-ridge`);
  await expect(page.getByText(title)).toHaveCount(0);

  const clerk = await signIn(browser, "helen.cho@cedarridge.example");
  await clerk.goto(`${STAFF}/cedar-ridge/content/announcements`);
  const item = clerk.getByRole("listitem").filter({ hasText: title });
  await item.locator("summary").filter({ hasText: "Publish" }).click();
  await item.getByRole("button", { name: `Publish announcement: ${title}` }).click();
  await expect(item.getByText("Published", { exact: true })).toBeVisible();
  await expectNoA11yViolations(clerk, "staff announcements (publisher)");

  await page.goto(`${SITE}/cedar-ridge`);
  await expect(page.getByRole("heading", { level: 3, name: title })).toBeVisible();

  await item.getByRole("button", { name: `Remove from website: ${title}` }).click();
  await expect(item.getByText("Expired", { exact: true })).toBeVisible();
  await page.goto(`${SITE}/cedar-ridge`);
  await expect(page.getByText(title)).toHaveCount(0);
  await clerk.context().close();
});

test("website tools are hidden from and closed to staff without content permissions", async ({
  browser,
}) => {
  const tech = await signIn(browser, "priya.nair@cedarridge.example");
  await expect(tech.getByRole("link", { name: "Website" })).toHaveCount(0);
  expect((await tech.goto(`${STAFF}/cedar-ridge/content`))?.status()).toBe(404);
  expect((await tech.goto(`${STAFF}/cedar-ridge/content/announcements`))?.status()).toBe(404);
  expect((await tech.goto(`${STAFF}/cedar-ridge/content/new`))?.status()).toBe(404);
  await tech.context().close();

  const auditor = await signIn(browser, "avery.stone@cedarridge.example");
  await auditor.goto(`${STAFF}/cedar-ridge/content`);
  await expect(auditor.getByRole("link", { name: "New page" })).toHaveCount(0);
  await auditor.getByRole("link", { name: "About Cedar Ridge" }).click();
  await expect(auditor.getByText("You have read-only access to website content.")).toBeVisible();
  await expect(auditor.getByRole("main").getByRole("button")).toHaveCount(0);
  expect((await auditor.goto(`${STAFF}/cedar-ridge/content/new`))?.status()).toBe(404);
  await auditor.context().close();

  const outsider = await signIn(browser, "grace.okafor@marlowsprings.example");
  expect((await outsider.goto(`${STAFF}/cedar-ridge/content`))?.status()).toBe(404);
  await outsider.context().close();
});
