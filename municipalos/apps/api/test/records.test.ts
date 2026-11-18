/**
 * Records: complete-record export and audit log export.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { csvCell } from "../src/routes/records";
import { CR, MS, USERS, createTestApp, submitRequest, type TestApp } from "./helpers";

let t: TestApp;
let request: { id: string; reference: string };

beforeAll(async () => {
  t = await createTestApp();
  request = await submitRequest(t, {
    reporterName: "Export Subject",
    reporterEmail: "export.subject@residents.example",
    description: '=HYPERLINK("http://evil") pothole by the depot',
  });
  const token = await t.login(USERS.crPwDirector);
  await t.api("POST", `${CR}/service-requests/${request.id}/comments`, {
    token,
    json: { body: "Internal: crew 4 nearby.", visibility: "internal" },
  });
  await t.api("POST", `${CR}/service-requests/${request.id}/status`, {
    token,
    json: { to: "reviewed" },
  });
});
afterAll(() => t.close());

describe("record export", () => {
  const path = () => `${CR}/service-requests/${request.id}/export`;

  it("requires records.export", async () => {
    expect((await t.raw(path())).status).toBe(401);
    for (const user of [USERS.crPwDirector, USERS.crPwTech, USERS.crParks]) {
      expect((await t.raw(path(), await t.login(user))).status, user).toBe(403);
    }
    expect((await t.raw(path(), await t.login(USERS.msAdmin))).status).toBe(403);
    expect(
      (await t.raw(`${MS}/service-requests/${request.id}/export`, await t.login(USERS.msAdmin)))
        .status,
    ).toBe(404);
  });

  it("returns the complete record as a download, including internal notes and contact details", async () => {
    const res = await t.raw(path(), await t.login(USERS.crClerk));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="${request.reference}.json"`,
    );
    const record = (await res.json()) as {
      history: { type: string }[];
      emailsToResident: unknown[];
    };
    expect(record).toMatchObject({
      exportedBy: "Helen Cho",
      municipality: { name: "Cedar Ridge" },
      request: {
        reference: request.reference,
        status: "reviewed",
        reporter: { name: "Export Subject", email: "export.subject@residents.example" },
      },
    });
    expect(record.history.map((e: { type: string }) => e.type)).toEqual([
      "created",
      "staff_note",
      "status_changed",
    ]);
    expect(record.history[1]).toMatchObject({
      visibility: "internal",
      body: "Internal: crew 4 nearby.",
      actorName: "Luis Ortega",
    });
    expect(record.emailsToResident.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(record)).not.toMatch(/storageKey|storage_key|password|tokenHash/);
  });

  it("audits every export", async () => {
    await t.raw(path(), await t.login(USERS.crAuditor));
    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    const exports = audit.body.items.filter(
      (e: { action: string; entityId: string }) =>
        e.action === "record.exported" && e.entityId === request.id,
    );
    expect(exports.map((e: { actorName: string }) => e.actorName).sort()).toEqual([
      "Avery Stone",
      "Helen Cho",
    ]);
  });
});

describe("audit log export", () => {
  it("requires audit.read and stays within the caller's municipality", async () => {
    expect((await t.raw(`${CR}/audit-events/export`, await t.login(USERS.crClerk))).status).toBe(
      403,
    );
    expect((await t.raw(`${CR}/audit-events/export`, await t.login(USERS.msAdmin))).status).toBe(
      403,
    );
    const ms = await t.raw(`${MS}/audit-events/export`, await t.login(USERS.msAdmin));
    expect(ms.status).toBe(200);
    expect(await ms.text()).not.toContain(request.reference);
  });

  it("produces CSV with a header, the events, and a record of the export itself", async () => {
    const token = await t.login(USERS.crAuditor);
    const res = await t.raw(`${CR}/audit-events/export`, token);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="audit-log-cedar-ridge-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines[0]).toBe(
      '"time_utc","action","actor_kind","actor_name","entity_type","entity_id","details","client_address","request_id"',
    );
    expect(
      lines.some((l) => l.includes('"service_request.created"') && l.includes(request.id)),
    ).toBe(true);
    const again = await (await t.raw(`${CR}/audit-events/export`, token)).text();
    expect(again).toContain('"audit.exported"');
  });

  it("filters by date and rejects malformed dates", async () => {
    const token = await t.login(USERS.crAuditor);
    const future = await (await t.raw(`${CR}/audit-events/export?from=2999-01-01`, token)).text();
    expect(future.trim().split("\r\n")).toHaveLength(1);
    expect((await t.raw(`${CR}/audit-events/export?from=yesterday`, token)).status).toBe(404);
  });

  it("neutralises spreadsheet formulas in cells", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("@sum")).toBe(`"'@sum"`);
    expect(csvCell("plain, text")).toBe('"plain, text"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
});

describe("retention, legal holds and disposition", () => {
  let clerk: string;
  let old: { id: string; reference: string };
  let recent: { id: string; reference: string };
  let held: { id: string; reference: string };
  let holdId: string;

  const backdateClose = async (id: string, days: number) => {
    const { createDb, sql } = await import("@municipalos/database");
    // Test set-up only: rewrite closed_at as the schema owner (the runtime role is used everywhere else).
    const owner = createDb(
      process.env.TEST_DATABASE_MIGRATION_URL ??
        "postgres://municipalos_owner:dev_owner_password@localhost:5432/municipalos_test",
      { max: 1 },
    );
    try {
      await owner.db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('app.tenant_id', (select id::text from municipalities where slug = 'cedar-ridge'), true)`,
        );
        await tx.execute(
          sql`update service_requests set closed_at = now() - make_interval(days => ${days}) where id = ${id}`,
        );
      });
    } finally {
      await owner.close();
    }
  };
  const close = async (r: { id: string }) => {
    const res = await t.api("POST", `${CR}/service-requests/${r.id}/status`, {
      token: await t.login(USERS.crAdmin),
      json: { to: "closed", note: "Closed for retention test." },
    });
    expect(res.status).toBe(200);
  };

  beforeAll(async () => {
    clerk = await t.login(USERS.crClerk);
    const contact = {
      reporterName: "Retention Person",
      reporterEmail: "retention.person@residents.example",
      reporterPhone: "435-555-0177",
    };
    old = await submitRequest(t, contact);
    recent = await submitRequest(t, contact);
    held = await submitRequest(t, contact);
    for (const r of [old, recent, held]) await close(r);
    await backdateClose(old.id, 400);
    await backdateClose(held.id, 400);
  });

  it("is limited to records.manage", async () => {
    for (const user of [USERS.crPwDirector, USERS.crPwTech, USERS.crAuditor]) {
      const token = await t.login(user);
      expect((await t.api("GET", `${CR}/records/retention`, { token })).status, user).toBe(403);
      expect((await t.api("GET", `${CR}/records/disposition`, { token })).status, user).toBe(403);
      expect(
        (
          await t.api("POST", `${CR}/records/disposition`, {
            token,
            json: { requestIds: [old.id], confirm: true },
          })
        ).status,
        user,
      ).toBe(403);
      expect(
        (
          await t.api("POST", `${CR}/service-requests/${old.id}/holds`, {
            token,
            json: { reason: "Not allowed to do this" },
          })
        ).status,
        user,
      ).toBe(403);
    }
    expect(
      (await t.api("GET", `${CR}/records/disposition`, { token: await t.login(USERS.msAdmin) }))
        .status,
    ).toBe(403);
  });

  it("keeps everything permanently until a retention period is set", async () => {
    const schedule = await t.api("GET", `${CR}/records/retention`, { token: clerk });
    expect(schedule.body.items).toEqual([
      {
        recordType: "service_request",
        retentionDays: null,
        authority: null,
        updatedAt: null,
        updatedByName: null,
      },
    ]);
    const review = await t.api("GET", `${CR}/records/disposition`, { token: clerk });
    expect(review.body).toMatchObject({ retentionDays: null, eligible: [] });
    const attempt = await t.api("POST", `${CR}/records/disposition`, {
      token: clerk,
      json: { requestIds: [old.id], confirm: true },
    });
    expect(attempt.status).toBe(422);
    expect(attempt.body.error.code).toBe("no_retention_period");
  });

  it("requires a legal authority and a sensible period", async () => {
    const put = (json: object) =>
      t.api("PUT", `${CR}/records/retention/service_request`, { token: clerk, json });
    expect((await put({ retentionDays: 365 })).status).toBe(422);
    expect((await put({ retentionDays: 5, authority: "Too short" })).status).toBe(422);
    expect(
      (
        await put({
          retentionDays: 365,
          authority: "Utah Municipal General Records Retention Schedule, item 1-23 (synthetic)",
        })
      ).status,
    ).toBe(200);
    const schedule = await t.api("GET", `${CR}/records/retention`, { token: clerk });
    expect(schedule.body.items[0]).toMatchObject({
      retentionDays: 365,
      updatedByName: "Helen Cho",
    });
    // Another city's schedule is untouched.
    const ms = await t.api("GET", `${MS}/records/retention`, {
      token: await t.login(USERS.msAdmin),
    });
    expect(ms.body.items[0].retentionDays).toBeNull();
  });

  it("places a legal hold, which shows on the record and removes it from the disposition list", async () => {
    const res = await t.api("POST", `${CR}/service-requests/${held.id}/holds`, {
      token: clerk,
      json: { reason: "Claim filed against the city, matter 2026-014." },
    });
    expect(res.status).toBe(201);
    holdId = res.body.id;
    const detail = await t.api("GET", `${CR}/service-requests/${held.id}`, { token: clerk });
    expect(detail.body.onLegalHold).toBe(true);
    expect(detail.body.events.at(-1)).toMatchObject({
      type: "legal_hold_placed",
      visibility: "internal",
    });

    const review = await t.api("GET", `${CR}/records/disposition`, { token: clerk });
    const refs = review.body.eligible.map((r: { reference: string }) => r.reference);
    expect(refs).toContain(old.reference);
    expect(refs).not.toContain(held.reference); // on hold
    expect(refs).not.toContain(recent.reference); // retention period not passed
    expect(review.body.onHold).toBe(1);
    // Holds never appear on the resident's tracking page.
    const pub = await t.api(
      "GET",
      `/v1/public/municipalities/cedar-ridge/service-requests/${held.reference}`,
    );
    expect(JSON.stringify(pub.body)).not.toMatch(/hold|Claim filed/i);
  });

  it("dispositions only eligible records and explains each one it skips", async () => {
    const msRequest = await submitRequest(
      t,
      {},
      { base: "/v1/public/municipalities/marlow-springs", staffBase: MS, lookupAs: USERS.msAdmin },
    );
    const res = await t.api("POST", `${CR}/records/disposition`, {
      token: clerk,
      json: { requestIds: [old.id, recent.id, held.id, request.id, msRequest.id], confirm: true },
    });
    expect(res.status).toBe(200);
    expect(res.body.dispositioned).toEqual([old.id]);
    expect(res.body.skipped).toEqual(
      expect.arrayContaining([
        { id: recent.id, reason: "retention_period_not_passed" },
        { id: held.id, reason: "legal_hold" },
        { id: request.id, reason: "not_closed" },
        { id: msRequest.id, reason: "not_found" }, // another municipality's record
      ]),
    );
    expect(
      (
        await t.api("POST", `${CR}/records/disposition`, {
          token: clerk,
          json: { requestIds: [old.id] },
        })
      ).status,
    ).toBe(422); // no confirm
  });

  it("redacts personal data but keeps the record and its history", async () => {
    const detail = await t.api("GET", `${CR}/service-requests/${old.id}`, { token: clerk });
    expect(detail.body.reporter).toEqual({ name: null, email: null, phone: null });
    expect(detail.body.dispositionedAt).not.toBeNull();
    expect(detail.body.reference).toBe(old.reference);
    expect(detail.body.events.map((e: { type: string }) => e.type)).toEqual([
      "created",
      "status_changed",
      "dispositioned",
    ]);

    const exported = await (await t.raw(`${CR}/service-requests/${old.id}/export`, clerk)).text();
    expect(exported).not.toContain("retention.person@residents.example");
    expect(exported).not.toContain("Retention Person");
    expect(exported).not.toContain("435-555-0177");

    const kept = await t.api("GET", `${CR}/service-requests/${held.id}`, { token: clerk });
    expect(kept.body.reporter.email).toBe("retention.person@residents.example");

    const again = await t.api("POST", `${CR}/records/disposition`, {
      token: clerk,
      json: { requestIds: [old.id], confirm: true },
    });
    expect(again.body.skipped).toEqual([{ id: old.id, reason: "already_dispositioned" }]);
  });

  it("is enforced by the database even if application checks were bypassed", async () => {
    const { schema, sql, withTenant } = await import("@municipalos/database");
    const [cr] = await t.handle.db
      .select()
      .from(schema.municipalities)
      .where(sql`slug = 'cedar-ridge'`);
    const run = (q: ReturnType<typeof sql>) =>
      withTenant(t.handle.db, { municipalityId: cr!.id }, (tx) => tx.execute(q));
    await expect(
      run(sql`update service_requests set dispositioned_at = now() where id = ${held.id}`),
    ).rejects.toThrow();
    await expect(
      run(sql`update service_requests set dispositioned_at = now() where id = ${request.id}`),
    ).rejects.toThrow(); // not closed
    await expect(
      run(sql`update service_requests set dispositioned_at = null where id = ${old.id}`),
    ).rejects.toThrow(); // cannot undo
    await expect(run(sql`delete from legal_holds`)).rejects.toThrow();
    await expect(run(sql`update legal_holds set reason = 'edited'`)).rejects.toThrow();
    await expect(run(sql`delete from retention_policies`)).rejects.toThrow();
    expect(await t.handle.db.select().from(schema.legalHolds)).toEqual([]); // no tenant, no rows
  });

  it("releases a hold with a note, after which the record becomes eligible; all of it is audited", async () => {
    const otherCity = await t.api("POST", `${MS}/records/holds/${holdId}/release`, {
      token: await t.login(USERS.msAdmin),
      json: { note: "Trying from another city." },
    });
    expect(otherCity.status).toBe(404);
    expect(
      (
        await t.api("POST", `${CR}/records/holds/${holdId}/release`, {
          token: clerk,
          json: { note: "x" },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await t.api("POST", `${CR}/records/holds/${holdId}/release`, {
          token: clerk,
          json: { note: "Matter 2026-014 settled and closed." },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await t.api("POST", `${CR}/records/holds/${holdId}/release`, {
          token: clerk,
          json: { note: "Releasing a second time." },
        })
      ).status,
    ).toBe(409);

    const holds = await t.api("GET", `${CR}/service-requests/${held.id}/holds`, { token: clerk });
    expect(holds.body.items[0]).toMatchObject({
      placedByName: "Helen Cho",
      releasedByName: "Helen Cho",
      releaseNote: "Matter 2026-014 settled and closed.",
    });
    const review = await t.api("GET", `${CR}/records/disposition`, { token: clerk });
    expect(review.body.eligible.map((r: { reference: string }) => r.reference)).toContain(
      held.reference,
    );

    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    const actions = audit.body.items.map((e: { action: string }) => e.action);
    for (const action of [
      "records.retention_changed",
      "records.legal_hold_placed",
      "records.legal_hold_released",
      "records.dispositioned",
    ]) {
      expect(actions, action).toContain(action);
    }
  });
});
