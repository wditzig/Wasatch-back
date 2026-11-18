/**
 * Municipal administration: categories, settings and staff access.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CR, MS, PUB_CR, PUB_MS, USERS, createTestApp, type TestApp } from "./helpers";

let t: TestApp;
let admin: string;
beforeAll(async () => {
  t = await createTestApp();
  admin = await t.login(USERS.crAdmin);
});
afterAll(() => t.close());

const departmentId = async (name: string, base = CR, token = admin) => {
  const res = await t.api("GET", `${base}/departments`, { token });
  return res.body.items.find((d: { name: string }) => d.name === name).id as string;
};

describe("category management", () => {
  let id: string;

  it("is limited to roles with categories.manage", async () => {
    for (const user of [USERS.crPwDirector, USERS.crPwTech, USERS.crClerk, USERS.crAuditor]) {
      const token = await t.login(user);
      expect((await t.api("GET", `${CR}/admin/categories`, { token })).status, user).toBe(403);
      expect(
        (
          await t.api("POST", `${CR}/admin/categories`, {
            token,
            json: { name: "Nope", departmentId: await departmentId("Public Works") },
          })
        ).status,
        user,
      ).toBe(403);
    }
    expect(
      (await t.api("GET", `${CR}/admin/categories`, { token: await t.login(USERS.msAdmin) }))
        .status,
    ).toBe(403);
  });

  it("creates a category that residents can use immediately, routed to the chosen department", async () => {
    const res = await t.api("POST", `${CR}/admin/categories`, {
      token: admin,
      json: {
        name: "Dead animal removal",
        description: "Animal remains on a street or in a park.",
        departmentId: await departmentId("Parks & Recreation"),
        keywords: ["Dead Animal", "roadkill", "roadkill"],
      },
    });
    expect(res.status).toBe(201);
    id = res.body.id;

    const publicList = await t.api("GET", `${PUB_CR}/service-categories`);
    const created = publicList.body.items.find(
      (c: { slug: string }) => c.slug === "dead-animal-removal",
    );
    expect(created).toMatchObject({
      name: "Dead animal removal",
      departmentName: "Parks & Recreation",
    });
    const suggestion = await t.api("POST", `${PUB_CR}/service-categories/suggest`, {
      json: { description: "There is roadkill on Main Street" },
    });
    expect(suggestion.body.suggestions[0].name).toBe("Dead animal removal");

    const submitted = await t.api("POST", `${PUB_CR}/service-requests`, {
      json: {
        categoryId: id,
        description: "Deer carcass on the shoulder.",
        locationText: "Hwy 40 mile 3",
      },
    });
    expect(submitted.body).toMatchObject({ departmentName: "Parks & Recreation" });
    // Marlow Springs is unaffected.
    const other = await t.api("GET", `${PUB_MS}/service-categories`);
    expect(other.body.items.some((c: { slug: string }) => c.slug === "dead-animal-removal")).toBe(
      false,
    );
  });

  it("rejects duplicates, unknown departments and another city's department", async () => {
    const pw = await departmentId("Public Works");
    expect(
      (
        await t.api("POST", `${CR}/admin/categories`, {
          token: admin,
          json: { name: "dead ANIMAL removal", departmentId: pw },
        })
      ).status,
    ).toBe(409);
    const foreign = await departmentId("Public Works", MS, await t.login(USERS.msAdmin));
    const res = await t.api("POST", `${CR}/admin/categories`, {
      token: admin,
      json: { name: "Cross city", departmentId: foreign },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_department");
    expect(
      (
        await t.api("POST", `${CR}/admin/categories`, {
          token: admin,
          json: { name: "x", departmentId: pw },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await t.api("POST", `${CR}/admin/categories`, {
          token: admin,
          json: { name: "Bad keywords", departmentId: pw, keywords: ["<script>"] },
        })
      ).status,
    ).toBe(422);
  });

  it("re-routes and deactivates; inactive categories disappear for residents but stay in admin", async () => {
    const pw = await departmentId("Public Works");
    expect(
      (
        await t.api("PATCH", `${CR}/admin/categories/${id}`, {
          token: admin,
          json: { departmentId: pw, isActive: false },
        })
      ).status,
    ).toBe(200);
    const publicList = await t.api("GET", `${PUB_CR}/service-categories`);
    expect(publicList.body.items.some((c: { id: string }) => c.id === id)).toBe(false);
    const submit = await t.api("POST", `${PUB_CR}/service-requests`, {
      json: { categoryId: id, description: "Should be refused now.", locationText: "Anywhere" },
    });
    expect(submit.body.error.code).toBe("invalid_category");
    const adminList = await t.api("GET", `${CR}/admin/categories`, { token: admin });
    expect(adminList.body.items.find((c: { id: string }) => c.id === id)).toMatchObject({
      isActive: false,
      departmentName: "Public Works",
      keywords: ["dead animal", "roadkill"],
    });
  });

  it("cannot edit another city's category by id", async () => {
    const msAdmin = await t.login(USERS.msAdmin);
    expect(
      (
        await t.api("PATCH", `${MS}/admin/categories/${id}`, {
          token: msAdmin,
          json: { name: "Hijacked" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await t.api("PATCH", `${CR}/admin/categories/${id}`, {
          token: msAdmin,
          json: { name: "Hijacked" },
        })
      ).status,
    ).toBe(403);
  });

  it("audits category changes", async () => {
    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    const actions = audit.body.items
      .filter((e: { entityId: string }) => e.entityId === id)
      .map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["category.created", "category.updated"]));
  });
});

describe("settings", () => {
  const valid = {
    branding: { primaryColor: "#7A1F3D", tagline: "New tagline" },
    contact: {
      address: "1 New Plaza, Cedar Ridge, UT 84000",
      phone: "(435) 555-0199",
      email: "hello@cedarridge.example",
      hours: "Mon–Fri 9–5",
    },
    allowAnonymousRequests: false,
  };

  it("is limited to settings.manage and to the caller's own city", async () => {
    expect(
      (await t.api("GET", `${CR}/admin/settings`, { token: await t.login(USERS.crClerk) })).status,
    ).toBe(403);
    expect(
      (
        await t.api("PUT", `${CR}/admin/settings`, {
          token: await t.login(USERS.crPwDirector),
          json: valid,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.api("PUT", `${CR}/admin/settings`, {
          token: await t.login(USERS.msAdmin),
          json: valid,
        })
      ).status,
    ).toBe(403);
  });

  it("rejects values that could break or deface the public site", async () => {
    const bad = (patch: object) =>
      t.api("PUT", `${CR}/admin/settings`, { token: admin, json: { ...valid, ...patch } });
    expect((await bad({ branding: { primaryColor: "red; background:url(//evil)" } })).status).toBe(
      422,
    );
    expect((await bad({ branding: { primaryColor: "#12345" } })).status).toBe(422);
    expect((await bad({ contact: { ...valid.contact, email: "not-an-email" } })).status).toBe(422);
    expect((await bad({ contact: { ...valid.contact, phone: "<b>call</b>" } })).status).toBe(422);
  });

  it("saves and takes effect on the public site and on reporting policy, for this city only", async () => {
    const before = await t.api("GET", PUB_MS);
    expect((await t.api("PUT", `${CR}/admin/settings`, { token: admin, json: valid })).status).toBe(
      200,
    );
    const site = await t.api("GET", PUB_CR);
    expect(site.body).toMatchObject({
      branding: { primaryColor: "#7a1f3d", tagline: "New tagline" },
      allowAnonymousRequests: false,
    });
    expect(site.body.contact.phone).toBe("(435) 555-0199");
    expect((await t.api("GET", PUB_MS)).body).toEqual(before.body);

    const cats = await t.api("GET", `${PUB_CR}/service-categories`);
    const anonymous = await t.api("POST", `${PUB_CR}/service-requests`, {
      json: {
        categoryId: cats.body.items[0].id,
        description: "Anonymous after policy change.",
        locationText: "Somewhere",
      },
    });
    expect(anonymous.status).toBe(422);
    expect(anonymous.body.error.code).toBe("contact_required");

    // Restore so other test files see the seeded policy.
    const restored = await t.api("PUT", `${CR}/admin/settings`, {
      token: admin,
      json: {
        ...valid,
        branding: { primaryColor: "#1f5f8b", tagline: "A mountain community that works." },
        allowAnonymousRequests: true,
      },
    });
    expect(restored.status).toBe(200);
  });
});

describe("staff access management", () => {
  const members = async (token = admin, base = CR) =>
    (await t.api("GET", `${base}/admin/staff`, { token })).body.items as {
      membershipId: string;
      name: string;
      roleKey: string;
      status: string;
      isSelf: boolean;
      email: string;
    }[];
  const roles = async () =>
    (await t.api("GET", `${CR}/admin/roles`, { token: admin })).body.items as {
      id: string;
      key: string;
      permissions: { key: string }[];
    }[];

  it("lists staff and roles for access review without exposing credentials", async () => {
    const list = await t.api("GET", `${CR}/admin/staff`, { token: await t.login(USERS.crAuditor) });
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(list.body)).not.toMatch(/scrypt|password/i);
    expect(
      list.body.items.every((m: { email: string }) => m.email.endsWith("@cedarridge.example")),
    ).toBe(true);
    expect(
      (await t.api("GET", `${CR}/admin/staff`, { token: await t.login(USERS.crPwTech) })).status,
    ).toBe(403);
    const r = await roles();
    expect(r.find((x) => x.key === "auditor")!.permissions.map((p) => p.key)).toContain(
      "audit.read",
    );
  });

  it("only staff.manage can change access, and nobody can change their own", async () => {
    const all = await members();
    const priya = all.find((m) => m.name === "Priya Nair")!;
    const adminRole = (await roles()).find((r) => r.key === "municipal_admin")!;

    for (const user of [USERS.crPwDirector, USERS.crClerk, USERS.crAuditor, USERS.crPwTech]) {
      const res = await t.api("PATCH", `${CR}/admin/staff/${priya.membershipId}`, {
        token: await t.login(user),
        json: { roleId: adminRole.id },
      });
      expect(res.status, user).toBe(403);
    }
    // A technician cannot promote herself even with the right endpoint.
    expect((await members()).find((m) => m.name === "Priya Nair")!.roleKey).toBe(
      "department_employee",
    );

    const self = all.find((m) => m.isSelf)!;
    expect(self.name).toBe("Dana Whitaker");
    const own = await t.api("PATCH", `${CR}/admin/staff/${self.membershipId}`, {
      token: admin,
      json: { status: "suspended" },
    });
    expect(own.status).toBe(403);
  });

  it("rejects roles, departments and memberships from another city", async () => {
    const msAdmin = await t.login(USERS.msAdmin);
    const msRoles = (await t.api("GET", `${MS}/admin/roles`, { token: msAdmin })).body.items;
    const msMembers = await members(msAdmin, MS);
    const priya = (await members()).find((m) => m.name === "Priya Nair")!;

    const foreignRole = await t.api("PATCH", `${CR}/admin/staff/${priya.membershipId}`, {
      token: admin,
      json: { roleId: msRoles[0].id },
    });
    expect(foreignRole.status).toBe(422);
    const foreignMember = await t.api(
      "PATCH",
      `${CR}/admin/staff/${msMembers.find((m) => !m.isSelf)!.membershipId}`,
      { token: admin, json: { status: "suspended" } },
    );
    expect(foreignMember.status).toBe(404);
    expect((await members(msAdmin, MS)).every((m) => m.status === "active")).toBe(true);
    expect(
      (
        await t.api("PATCH", `${CR}/admin/staff/${priya.membershipId}`, {
          token: msAdmin,
          json: { status: "suspended" },
        })
      ).status,
    ).toBe(403);
  });

  it("applies a role change on the member's very next request", async () => {
    const tom = (await members()).find((m) => m.name === "Tom Becker")!;
    const token = await t.login(USERS.crParks);
    expect((await t.api("GET", `${CR}/audit-events`, { token })).status).toBe(403);
    const all = await roles();
    const change = await t.api("PATCH", `${CR}/admin/staff/${tom.membershipId}`, {
      token: admin,
      json: { roleId: all.find((r) => r.key === "auditor")!.id },
    });
    expect(change.status).toBe(200);
    expect((await t.api("GET", `${CR}/audit-events`, { token })).status).toBe(200);
    const note = await t.api("GET", `${CR}/notifications`, { token });
    expect(note.body.items[0]).toMatchObject({
      subject: "Your access was updated",
      body: "Your role is now Read-Only Auditor.",
    });
    // Restore.
    await t.api("PATCH", `${CR}/admin/staff/${tom.membershipId}`, {
      token: admin,
      json: { roleId: all.find((r) => r.key === "department_employee")!.id },
    });
    expect((await t.api("GET", `${CR}/audit-events`, { token })).status).toBe(403);
  });

  it("suspending a member cuts off access immediately, and it is audited with before and after", async () => {
    const helen = (await members()).find((m) => m.name === "Helen Cho")!;
    const token = await t.login(USERS.crClerk);
    expect((await t.api("GET", `${CR}/dashboard`, { token })).status).toBe(200);
    expect(
      (
        await t.api("PATCH", `${CR}/admin/staff/${helen.membershipId}`, {
          token: admin,
          json: { status: "suspended" },
        })
      ).status,
    ).toBe(200);
    expect((await t.api("GET", `${CR}/dashboard`, { token })).status).toBe(403);
    expect((await t.api("GET", "/v1/auth/me", { token })).body.memberships).toEqual([]);

    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    const entry = audit.body.items.find(
      (e: { action: string; entityId: string }) =>
        e.action === "staff.access_changed" && e.entityId === helen.membershipId,
    );
    expect(entry.metadata).toMatchObject({
      before: { status: "active" },
      after: { status: "suspended" },
    });
    expect(entry.actorName).toBe("Dana Whitaker");

    expect(
      (
        await t.api("PATCH", `${CR}/admin/staff/${helen.membershipId}`, {
          token: admin,
          json: { status: "active" },
        })
      ).status,
    ).toBe(200);
    expect((await t.api("GET", `${CR}/dashboard`, { token })).status).toBe(200);
  });
});
