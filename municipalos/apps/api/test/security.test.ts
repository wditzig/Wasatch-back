/**
 * Security tests: tenant isolation (API and database level), authentication, role escalation,
 * sensitive data exposure and abuse controls.
 */
import { schema, sql, withTenant } from "@municipalos/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CR,
  MS,
  PUB_CR,
  PUB_MS,
  USERS,
  categoryId,
  createTestApp,
  submitRequest,
  type TestApp,
} from "./helpers";

let t: TestApp;
let crRequest: { id: string; reference: string };
let msRequest: { id: string; reference: string };

beforeAll(async () => {
  t = await createTestApp();
  crRequest = await submitRequest(t, { reporterEmail: "cr.resident@residents.example" });
  msRequest = await submitRequest(
    t,
    { reporterEmail: "ms.resident@residents.example" },
    { base: PUB_MS, staffBase: MS, lookupAs: USERS.msAdmin },
  );
});
afterAll(() => t.close());

describe("authentication", () => {
  it("rejects staff endpoints without a valid session", async () => {
    expect((await t.api("GET", `${CR}/service-requests`)).status).toBe(401);
    expect((await t.api("GET", `${CR}/service-requests`, { token: "x".repeat(43) })).status).toBe(
      401,
    );
    expect(
      (await t.api("GET", `${CR}/service-requests`, { headers: { authorization: "Basic abc" } }))
        .status,
    ).toBe(401);
  });

  it("gives the same answer for a wrong password and an unknown account", async () => {
    const wrong = await t.api("POST", "/v1/auth/login", {
      json: { email: USERS.crAdmin, password: "nope-nope-nope" },
    });
    const unknown = await t.api("POST", "/v1/auth/login", {
      json: { email: "nobody@cedarridge.example", password: "nope-nope-nope" },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  it("stores only a hash of the session token and honours logout", async () => {
    const res = await t.api("POST", "/v1/auth/login", {
      json: { email: USERS.crClerk, password: "municipalos-dev-password" },
    });
    const token = res.body.token as string;
    const stored = await t.handle.db
      .select({ tokenHash: schema.sessions.tokenHash })
      .from(schema.sessions);
    expect(stored.some((s) => s.tokenHash === token)).toBe(false);
    expect((await t.api("GET", "/v1/auth/me", { token })).status).toBe(200);
    expect((await t.api("POST", "/v1/auth/logout", { token })).status).toBe(200);
    expect((await t.api("GET", "/v1/auth/me", { token })).status).toBe(401);
  });

  it("never returns password hashes", async () => {
    const me = await t.api("GET", "/v1/auth/me", { token: await t.login(USERS.crAdmin) });
    expect(JSON.stringify(me.body)).not.toMatch(/scrypt|passwordHash|password_hash/);
  });

  it("throttles repeated login attempts", async () => {
    const limited = await createTestApp({ login: { limit: 3, windowMs: 60_000 } });
    try {
      const attempt = () =>
        limited.api("POST", "/v1/auth/login", {
          json: { email: USERS.crAdmin, password: "wrong-password" },
        });
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await attempt()).status);
      expect(statuses).toEqual([401, 401, 401, 429, 429]);
      const last = await attempt();
      expect(Number(last.headers.get("retry-after"))).toBeGreaterThan(0);
    } finally {
      await limited.close();
    }
  });
});

describe("tenant isolation through the API", () => {
  it("denies staff of one municipality any access to another municipality", async () => {
    const msAdmin = await t.login(USERS.msAdmin);
    for (const path of [
      "/me",
      "/dashboard",
      "/service-requests",
      "/notifications",
      "/audit-events",
      "/departments",
      `/service-requests/${crRequest.id}`,
    ]) {
      const res = await t.api("GET", `${CR}${path}`, { token: msAdmin });
      expect(res.status, path).toBe(403);
    }
    const write = await t.api("POST", `${CR}/service-requests/${crRequest.id}/status`, {
      token: msAdmin,
      json: { to: "reviewed" },
    });
    expect(write.status).toBe(403);
  });

  it("does not resolve another municipality's record id inside the caller's own municipality", async () => {
    const msAdmin = await t.login(USERS.msAdmin);
    // Marlow Springs admin has full rights at home, but a Cedar Ridge id does not exist there.
    expect(
      (await t.api("GET", `${MS}/service-requests/${crRequest.id}`, { token: msAdmin })).status,
    ).toBe(404);
    expect(
      (
        await t.api("POST", `${MS}/service-requests/${crRequest.id}/status`, {
          token: msAdmin,
          json: { to: "reviewed" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await t.api("POST", `${MS}/service-requests/${crRequest.id}/comments`, {
          token: msAdmin,
          json: { body: "hello there", visibility: "internal" },
        })
      ).status,
    ).toBe(404);
    const untouched = await t.api("GET", `${CR}/service-requests/${crRequest.id}`, {
      token: await t.login(USERS.crAdmin),
    });
    expect(untouched.body.status).toBe("new");
    expect(untouched.body.events).toHaveLength(1);
  });

  it("never lists another municipality's requests, whatever filters are sent", async () => {
    const msAdmin = await t.login(USERS.msAdmin);
    const list = await t.api("GET", `${MS}/service-requests?status=all&pageSize=100&q=CR-`, {
      token: msAdmin,
    });
    expect(list.body.items).toEqual([]);
    const all = await t.api("GET", `${MS}/service-requests?status=all&pageSize=100`, {
      token: msAdmin,
    });
    expect(all.body.items.every((r: { reference: string }) => r.reference.startsWith("MS-"))).toBe(
      true,
    );
  });

  it("cannot assign a request to staff of another municipality", async () => {
    const crAdmin = await t.login(USERS.crAdmin);
    const msStaff = await t.api("GET", `${MS}/service-requests/${msRequest.id}/assignable-staff`, {
      token: await t.login(USERS.msAdmin),
    });
    const outsider = msStaff.body.items[0].id;
    const res = await t.api("POST", `${CR}/service-requests/${crRequest.id}/assign`, {
      token: crAdmin,
      json: { assigneeUserId: outsider },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_assignee");
  });

  it("rejects a category that belongs to another municipality", async () => {
    const res = await t.api("POST", `${PUB_CR}/service-requests`, {
      json: {
        categoryId: await categoryId(t.api, PUB_MS, "pothole"),
        description: "Cross-tenant category attempt.",
        locationText: "Somewhere",
      },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_category");
  });

  it("does not let a tracking number be read through another municipality's site", async () => {
    expect((await t.api("GET", `${PUB_MS}/service-requests/${crRequest.reference}`)).status).toBe(
      404,
    );
    expect(
      (
        await t.api("POST", `${PUB_MS}/service-requests/${crRequest.reference}/messages`, {
          json: { body: "wrong city" },
        })
      ).status,
    ).toBe(404);
  });

  it("gives platform administrators no implicit access to municipal records", async () => {
    const token = await t.login(USERS.platformAdmin);
    const me = await t.api("GET", "/v1/auth/me", { token });
    expect(me.body.memberships).toEqual([]);
    expect((await t.api("GET", `${CR}/service-requests`, { token })).status).toBe(403);
    expect((await t.api("GET", `${MS}/audit-events`, { token })).status).toBe(403);
  });

  it("audits cross-tenant access attempts in the targeted municipality", async () => {
    await t.api("GET", `${CR}/service-requests`, { token: await t.login(USERS.msPwOperator) });
    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    const denial = audit.body.items.find(
      (e: { action: string; actorName: string }) =>
        e.action === "authz.tenant_access_denied" && e.actorName === "Ben Hale",
    );
    expect(denial).toBeTruthy();
  });

  it("keeps audit logs separate per municipality", async () => {
    const ms = await t.api("GET", `${MS}/audit-events?pageSize=100`, {
      token: await t.login(USERS.msAdmin),
    });
    expect(ms.status).toBe(200);
    expect(ms.body.items.some((e: { entityId: string }) => e.entityId === crRequest.id)).toBe(
      false,
    );
    expect(JSON.stringify(ms.body)).not.toContain("CR-");
  });
});

describe("tenant isolation enforced by the database (row-level security)", () => {
  const { serviceRequests, auditEvents, serviceRequestEvents, notifications, staffMemberships } =
    schema;
  const idOf = async (slug: string) => {
    const [m] = await t.handle.db
      .select()
      .from(schema.municipalities)
      .where(sql`slug = ${slug}`);
    return m!.id;
  };

  it("returns no tenant rows when no tenant is set", async () => {
    expect(await t.handle.db.select().from(serviceRequests)).toEqual([]);
    expect(await t.handle.db.select().from(staffMemberships)).toEqual([]);
    expect(await t.handle.db.select().from(notifications)).toEqual([]);
    expect(await t.handle.db.select().from(auditEvents)).toEqual([]);
  });

  it("shows only the current tenant's rows even for an unfiltered query", async () => {
    const cr = await idOf("cedar-ridge");
    const rows = await withTenant(t.handle.db, { municipalityId: cr }, (tx) =>
      tx.select().from(serviceRequests),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.municipalityId === cr)).toBe(true);
  });

  it("refuses to write a row for a different tenant", async () => {
    const [cr, ms] = [await idOf("cedar-ridge"), await idOf("marlow-springs")];
    const attempt = withTenant(t.handle.db, { municipalityId: cr }, (tx) =>
      tx.insert(notifications).values({
        municipalityId: ms,
        channel: "email",
        recipientEmail: "x@example.com",
        subject: "x",
      }),
    );
    await expect(attempt).rejects.toThrow();
  });

  it("cannot update another tenant's rows", async () => {
    const ms = await idOf("marlow-springs");
    const updated = await withTenant(t.handle.db, { municipalityId: ms }, (tx) =>
      tx
        .update(serviceRequests)
        .set({ description: "tampered" })
        .where(sql`id = ${crRequest.id}`)
        .returning(),
    );
    expect(updated).toEqual([]);
  });

  it("makes cross-tenant references impossible via composite foreign keys", async () => {
    const [cr, ms] = [await idOf("cedar-ridge"), await idOf("marlow-springs")];
    const [msCategory] = await withTenant(t.handle.db, { municipalityId: ms }, (tx) =>
      tx.select().from(schema.serviceRequestCategories).limit(1),
    );
    const attempt = withTenant(t.handle.db, { municipalityId: cr }, (tx) =>
      tx.insert(serviceRequests).values({
        municipalityId: cr,
        reference: "CR-ZZZZZZZZ",
        categoryId: msCategory!.id,
        departmentId: msCategory!.departmentId,
        description: "cross-tenant fk",
        locationText: "nowhere",
      }),
    );
    await expect(attempt).rejects.toThrow();
  });

  it("keeps history and audit tables append-only for the runtime role", async () => {
    const cr = await idOf("cedar-ridge");
    const run = (q: ReturnType<typeof sql>) =>
      withTenant(t.handle.db, { municipalityId: cr }, (tx) => tx.execute(q));
    await expect(run(sql`delete from audit_events`)).rejects.toThrow();
    await expect(run(sql`update audit_events set action = 'x'`)).rejects.toThrow();
    await expect(run(sql`delete from service_request_events`)).rejects.toThrow();
    await expect(run(sql`update service_request_events set body = 'x'`)).rejects.toThrow();
    expect(
      (
        await withTenant(t.handle.db, { municipalityId: cr }, (tx) =>
          tx.select().from(serviceRequestEvents),
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it("does not let the runtime role change roles, memberships or users", async () => {
    const cr = await idOf("cedar-ridge");
    const run = (q: ReturnType<typeof sql>) =>
      withTenant(t.handle.db, { municipalityId: cr }, (tx) => tx.execute(q));
    await expect(run(sql`update staff_memberships set status = 'active'`)).rejects.toThrow();
    await expect(
      run(
        sql`insert into role_permissions (municipality_id, role_id, permission) select municipality_id, id, 'audit.read' from roles`,
      ),
    ).rejects.toThrow();
    await expect(run(sql`update users set is_platform_admin = true`)).rejects.toThrow();
  });
});

describe("role-based authorization", () => {
  it("scopes department staff to their own department", async () => {
    const parks = await t.login(USERS.crParks);
    const list = await t.api("GET", `${CR}/service-requests?status=all&pageSize=100`, {
      token: parks,
    });
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(
      list.body.items.every(
        (r: { departmentName: string }) => r.departmentName === "Parks & Recreation",
      ),
    ).toBe(true);
    // crRequest is a Public Works pothole: invisible to Parks, including by direct id.
    expect(
      (await t.api("GET", `${CR}/service-requests/${crRequest.id}`, { token: parks })).status,
    ).toBe(404);
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${crRequest.id}/status`, {
          token: parks,
          json: { to: "reviewed" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${crRequest.id}/comments`, {
          token: parks,
          json: { body: "not mine", visibility: "internal" },
        })
      ).status,
    ).toBe(404);
  });

  it("keeps the auditor read-only", async () => {
    const auditor = await t.login(USERS.crAuditor);
    expect(
      (await t.api("GET", `${CR}/service-requests/${crRequest.id}`, { token: auditor })).status,
    ).toBe(200);
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${crRequest.id}/status`, {
          token: auditor,
          json: { to: "reviewed" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${crRequest.id}/comments`, {
          token: auditor,
          json: { body: "a note", visibility: "internal" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${crRequest.id}/assign`, {
          token: auditor,
          json: { assigneeUserId: crRequest.id },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.api("GET", `${CR}/service-requests/${crRequest.id}/assignable-staff`, {
          token: auditor,
        })
      ).status,
    ).toBe(403);
  });

  it("prevents a department employee from assigning, closing or reading the audit log", async () => {
    const tech = await t.login(USERS.crPwTech);
    const me = await t.api("GET", `${CR}/me`, { token: tech });
    expect(me.body.permissions.sort()).toEqual([
      "service_requests.comment",
      "service_requests.read_department",
      "service_requests.update_status",
    ]);
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${crRequest.id}/assign`, {
          token: tech,
          json: { assigneeUserId: me.body.user.id },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${crRequest.id}/status`, {
          token: tech,
          json: { to: "closed", note: "closing" },
        })
      ).status,
    ).toBe(403);
    expect((await t.api("GET", `${CR}/audit-events`, { token: tech })).status).toBe(403);
  });

  it("only lets users mark their own notifications read", async () => {
    const tech = await t.api("GET", `${CR}/notifications`, {
      token: await t.login(USERS.crPwTech),
    });
    const someoneElses = tech.body.items[0].id;
    const res = await t.api("POST", `${CR}/notifications/read`, {
      token: await t.login(USERS.crPwDirector),
      json: { id: someoneElses },
    });
    expect(res.status).toBe(404);
  });
});

describe("public surface", () => {
  it("exposes no reporter contact details or staff identities on public endpoints", async () => {
    const res = await t.api("GET", `${PUB_CR}/service-requests/${crRequest.reference}`);
    expect(Object.keys(res.body).sort()).toEqual([
      "categoryName",
      "createdAt",
      "departmentName",
      "description",
      "isOpen",
      "locationText",
      "reference",
      "status",
      "statusLabel",
      "timeline",
      "updatedAt",
    ]);
    expect(JSON.stringify(res.body)).not.toContain("residents.example");
  });

  it("treats malformed and unknown tracking numbers identically", async () => {
    const malformed = await t.api("GET", `${PUB_CR}/service-requests/' OR 1=1 --`);
    const unknown = await t.api("GET", `${PUB_CR}/service-requests/CR-00000000`);
    expect(malformed.status).toBe(404);
    expect(unknown.status).toBe(404);
  });

  it("rate limits public submissions per client address", async () => {
    const limited = await createTestApp({ publicSubmit: { limit: 2, windowMs: 60_000 } });
    try {
      const json = {
        categoryId: await categoryId(limited.api, PUB_CR, "other"),
        description: "Rate limit probe request.",
        locationText: "Test St",
      };
      const send = (ip: string) =>
        limited.api("POST", `${PUB_CR}/service-requests`, {
          json,
          headers: { "x-forwarded-for": ip },
        });
      expect((await send("203.0.113.9")).status).toBe(201);
      expect((await send("203.0.113.9")).status).toBe(201);
      expect((await send("203.0.113.9")).status).toBe(429);
      expect((await send("203.0.113.10")).status).toBe(201);
    } finally {
      await limited.close();
    }
  });

  it("rejects oversized request bodies", async () => {
    const res = await t.api("POST", `${PUB_CR}/service-requests`, {
      json: { description: "x".repeat(100_000) },
    });
    expect([413, 422]).toContain(res.status);
  });

  it("returns a consistent error envelope with a request id and no internals", async () => {
    const res = await t.api("GET", "/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "not_found", message: "Not found." },
      requestId: expect.any(String),
    });
    expect(res.headers.get("x-request-id")).toBe(res.body.requestId);
  });

  it("sets security headers and forbids caching of API responses", async () => {
    const res = await t.api("GET", `${PUB_CR}`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serves an OpenAPI document covering the core routes", async () => {
    const res = await t.api("GET", "/openapi.json");
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        "/v1/public/municipalities/{slug}/service-requests",
        "/v1/staff/{slug}/service-requests/{id}/status",
        "/v1/auth/login",
      ]),
    );
  });
});
