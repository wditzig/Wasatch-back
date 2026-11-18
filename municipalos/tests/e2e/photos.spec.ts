import { expect, test } from "@playwright/test";
import { PASSWORD, SITE, STAFF, expectNoA11yViolations } from "./helpers";

// A valid 2x2 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

const loaded = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

test("photos travel from resident to staff and back", async ({ page, browser }) => {
  await page.goto(`${SITE}/cedar-ridge/report?category=graffiti`);
  await page.getByLabel("Describe the problem").fill("Spray paint across the park restroom wall.");
  await page.getByLabel("Where is it?").fill(`E2E photo ${Date.now()} Miller Park`);

  // A file that is not an image is refused before anything is sent.
  await page
    .getByLabel("Photos")
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Photos must be JPEG, PNG or WebP images." }),
  ).toBeVisible();

  await page
    .getByLabel("Photos")
    .setInputFiles({ name: "wall.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Thank you. Your request was sent.")).toBeVisible();
  const reference = page.url().match(/requests\/(CR-[0-9A-Z]{8})/)![1]!;

  const residentPhoto = page.getByRole("img", { name: "Photo 1, added by you" });
  await expect(residentPhoto).toBeVisible();
  await expect.poll(() => residentPhoto.evaluate(loaded)).toBe(true);
  await expect(page.getByText("Photo added by you")).toBeVisible();

  // Staff see the resident's photo and add one of the finished work.
  const context = await browser.newContext();
  const staff = await context.newPage();
  await staff.goto(`${STAFF}/login`);
  await staff.getByLabel("Work email").fill("luis.ortega@cedarridge.example");
  await staff.getByLabel("Password").fill(PASSWORD);
  await staff.getByRole("button", { name: /sign in/i }).click();
  await staff.waitForURL((url) => !url.pathname.startsWith("/login"));
  await staff.goto(`${STAFF}/cedar-ridge/requests?status=all&q=${reference}`);
  await staff.getByRole("link", { name: reference }).first().click();
  const fromResident = staff.getByRole("img", { name: "Photo 1: from the resident" });
  await expect(fromResident).toBeVisible();
  await expect.poll(() => fromResident.evaluate(loaded)).toBe(true);

  await staff
    .getByLabel("Add a photo")
    .setInputFiles({ name: "done.png", mimeType: "image/png", buffer: PNG });
  await staff.getByRole("button", { name: "Upload photo" }).click();
  await expect(staff.getByText("Photo added. The resident can see it")).toBeVisible();
  await expect(staff.getByRole("img", { name: "Photo 2: added by Luis Ortega" })).toBeVisible();
  await expectNoA11yViolations(staff, "staff request detail with photos");

  // The photo URL is useless without the staff session.
  const src = await staff.getByRole("img", { name: /Photo 2/ }).getAttribute("src");
  const anonymous = await browser.newContext();
  const stranger = await anonymous.newPage();
  const res = await stranger.goto(`${STAFF}${src}`);
  expect(res?.headers()["content-type"] ?? "").not.toContain("image/");
  await expect(stranger).toHaveURL(/\/login/);
  await anonymous.close();
  await context.close();

  // The resident sees the completion photo.
  await page.reload();
  await expect(page.getByRole("img", { name: "Photo 2, added by city staff" })).toBeVisible();
  await expect(page.getByText("City staff added a photo")).toBeVisible();
  await expectNoA11yViolations(page, "tracking page with photos");
});
