import { expect, test } from "@playwright/test";
import { PASSWORD, SITE, STAFF } from "./helpers";

const port = new URL(SITE).port;
const CEDAR = `http://cedar-ridge.localhost:${port}`;

test.describe("custom municipal domains", () => {
  test("a city's own domain serves its site from the root", async ({ page }) => {
    await page.goto(CEDAR);
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome to Cedar Ridge" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Report a problem" }).first().click();
    await expect(page).toHaveURL(new RegExp(`^${CEDAR}(/cedar-ridge)?/report$`));
    await expect(page.getByRole("heading", { level: 1, name: "Report a problem" })).toBeVisible();

    await page.getByRole("radio", { name: /Pothole/ }).check();
    await page
      .getByLabel("Describe the problem")
      .fill("Custom domain submission of a pothole report.");
    await page.getByLabel("Where is it?").fill("Domain Test Rd");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Thank you. Your request was sent.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`^${CEDAR}(/cedar-ridge)?/requests/CR-[0-9A-Z]{8}`));
    // The clean form of an address works too.
    await page.goto(`${CEDAR}/departments`);
    await expect(page.getByRole("heading", { level: 1, name: "Departments" })).toBeVisible();
  });

  test("another city's pages are not reachable through a city's domain", async ({ page }) => {
    expect((await page.goto(`${CEDAR}/marlow-springs`))?.status()).toBe(404);
    expect((await page.goto(`${CEDAR}/marlow-springs/report`))?.status()).toBe(404);
    expect((await page.goto(`${CEDAR}/requests/MS-SAMP0001`))?.status()).toBe(404);
    expect((await page.goto(`http://unknown-city.localhost:${port}/`))?.status()).toBe(200); // falls back to the city picker
    await expect(page.getByRole("heading", { level: 1, name: "Choose your city" })).toBeVisible();
  });
});

test.describe("content security policy", () => {
  test("pages work under a nonce-based policy with no violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });

    const res = await page.goto(`${SITE}/cedar-ridge/report`);
    const csp = res?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    // Client-side behaviour still works, so scripts were allowed to run.
    await page
      .getByLabel("Describe the problem")
      .fill("The streetlight on the corner keeps flickering");
    await expect(page.getByRole("button", { name: "Use Streetlight" })).toBeVisible();

    // Injected inline code (the usual cross-site-scripting payload) is blocked.
    const ran = await page.evaluate(() => {
      const el = document.createElement("button");
      el.setAttribute("onclick", "window.__injected = true");
      document.body.appendChild(el);
      el.click();
      el.remove();
      return (window as unknown as { __injected?: boolean }).__injected === true;
    });
    expect(ran).toBe(false);
    violations.length = 0; // the probe above is expected to be reported

    const staff = await page.goto(`${STAFF}/login`);
    expect(staff?.headers()["content-security-policy"]).toContain("object-src 'none'");
    await page.getByLabel("Work email").fill("luis.ortega@cedarridge.example");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome, Luis");
    await page.getByRole("link", { name: "Requests", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(violations).toEqual([]);
  });
});
