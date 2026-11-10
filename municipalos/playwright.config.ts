import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests drive the real stack: API + city website + staff dashboard against the
 * seeded development database. Run `pnpm db:reset` first for a clean slate.
 *
 * Servers already running on these ports are reused; otherwise they are started here.
 * RATE_LIMIT_SCALE relaxes rate limits because every test shares one client address.
 */
const reuse = !process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { ...devices["Desktop Chrome"], trace: "off", screenshot: "only-on-failure" },
  webServer: [
    {
      command: "pnpm --filter @municipalos/api start",
      url: "http://localhost:4000/healthz",
      env: { RATE_LIMIT_SCALE: "100" },
      reuseExistingServer: reuse,
      timeout: 60_000,
    },
    {
      command: process.env.CI
        ? "pnpm --filter @municipalos/city-web start"
        : "pnpm --filter @municipalos/city-web dev",
      url: "http://localhost:3000",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      command: process.env.CI
        ? "pnpm --filter @municipalos/staff start"
        : "pnpm --filter @municipalos/staff dev",
      url: "http://localhost:3001/login",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
  ],
});
