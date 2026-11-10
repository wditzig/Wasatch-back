import { assertRuntimeRoleIsRestricted, createDb, type DbHandle } from "@municipalos/database";
import { DEMO_PASSWORD } from "@municipalos/database/seed";
import { MemoryEmailTransport } from "@municipalos/notifications";
import { createApp } from "../src/app";
import { DEFAULT_RATE_LIMITS, type AppConfig } from "../src/context";

const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://municipalos_app:dev_app_password@localhost:5432/municipalos_test";

const GENEROUS: AppConfig["rateLimits"] = {
  login: { limit: 10_000, windowMs: 60_000 },
  publicSubmit: { limit: 10_000, windowMs: 60_000 },
  publicMessage: { limit: 10_000, windowMs: 60_000 },
  publicRead: { limit: 100_000, windowMs: 60_000 },
};

export interface TestApp {
  handle: DbHandle;
  email: MemoryEmailTransport;
  api: Api;
  login(email: string, password?: string): Promise<string>;
  close(): Promise<void>;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export type Api = (
  method: string,
  path: string,
  options?: { token?: string; json?: unknown; headers?: Record<string, string> },
) => Promise<ApiResponse>;

/** Builds the real app against the real test database, connected as the restricted runtime role. */
export async function createTestApp(rateLimits: Partial<AppConfig["rateLimits"]> = {}): Promise<TestApp> {
  const handle = createDb(APP_URL, { max: 5 });
  await assertRuntimeRoleIsRestricted(handle.db);
  const email = new MemoryEmailTransport();
  const app = createApp({
    db: handle.db,
    email,
    config: {
      sessionTtlHours: 1,
      publicSiteUrl: "http://site.test",
      rateLimits: { ...DEFAULT_RATE_LIMITS, ...GENEROUS, ...rateLimits },
    },
  });

  const api: Api = async (method, path, options = {}) => {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.json !== undefined) headers["content-type"] = "application/json";
    const res = await app.request(path, {
      method,
      headers,
      body: options.json === undefined ? undefined : JSON.stringify(options.json),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };

  const tokens = new Map<string, string>();
  return {
    handle,
    email,
    api,
    async login(address, password = DEMO_PASSWORD) {
      const cached = tokens.get(address);
      if (cached) return cached;
      const res = await api("POST", "/v1/auth/login", { json: { email: address, password } });
      if (res.status !== 200) throw new Error(`login failed for ${address}: ${JSON.stringify(res.body)}`);
      tokens.set(address, res.body.token);
      return res.body.token as string;
    },
    close: () => handle.close(),
  };
}

export const USERS = {
  crAdmin: "dana.whitaker@cedarridge.example",
  crPwDirector: "luis.ortega@cedarridge.example",
  crPwTech: "priya.nair@cedarridge.example",
  crParks: "tom.becker@cedarridge.example",
  crClerk: "helen.cho@cedarridge.example",
  crAuditor: "avery.stone@cedarridge.example",
  msAdmin: "grace.okafor@marlowsprings.example",
  msPwOperator: "ben.hale@marlowsprings.example",
  platformAdmin: "ops@municipalos.example",
} as const;

export const CR = "/v1/staff/cedar-ridge";
export const MS = "/v1/staff/marlow-springs";
export const PUB_CR = "/v1/public/municipalities/cedar-ridge";
export const PUB_MS = "/v1/public/municipalities/marlow-springs";

export async function categoryId(api: Api, base: string, slug: string): Promise<string> {
  const res = await api("GET", `${base}/service-categories`);
  const found = res.body.items.find((c: { slug: string }) => c.slug === slug);
  if (!found) throw new Error(`category ${slug} not found`);
  return found.id;
}

/** Submits a request as a resident and returns its reference plus the staff-side id. */
export async function submitRequest(
  t: TestApp,
  overrides: Record<string, unknown> = {},
  opts: { base?: string; staffBase?: string; lookupAs?: string; category?: string } = {},
) {
  const base = opts.base ?? PUB_CR;
  const res = await t.api("POST", `${base}/service-requests`, {
    json: {
      categoryId: await categoryId(t.api, base, opts.category ?? "pothole"),
      description: "Large pothole in the right-hand lane near the crosswalk.",
      locationText: "900 E Harvest Ln",
      ...overrides,
    },
  });
  if (res.status !== 201) throw new Error(`submit failed: ${JSON.stringify(res.body)}`);
  const token = await t.login(opts.lookupAs ?? USERS.crAdmin);
  const list = await t.api("GET", `${opts.staffBase ?? CR}/service-requests?status=all&q=${res.body.reference}`, { token });
  return { reference: res.body.reference as string, id: list.body.items[0].id as string, created: res.body };
}
