/**
 * The first vertical slice, end to end through the real API and database:
 * resident submits -> routed to department -> staff works it -> resident sees updates ->
 * history, notifications and audit trail are recorded.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CR,
  PUB_CR,
  USERS,
  categoryId,
  createTestApp,
  submitRequest,
  type TestApp,
} from "./helpers";

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe("resident-to-employee service request workflow", () => {
  let reference: string;
  let id: string;

  it("lists subscribing municipalities and their configured services", async () => {
    const list = await t.api("GET", "/v1/public/municipalities");
    expect(list.body.items.map((m: { slug: string }) => m.slug)).toEqual([
      "cedar-ridge",
      "marlow-springs",
    ]);
    const cats = await t.api("GET", `${PUB_CR}/service-categories`);
    expect(cats.body.items.length).toBeGreaterThanOrEqual(6);
    expect(cats.body.items[0]).not.toHaveProperty("keywords");
  });

  it("suggests a category from the description and flags emergency wording", async () => {
    const res = await t.api("POST", `${PUB_CR}/service-categories/suggest`, {
      json: { description: "The streetlight on my corner is flickering" },
    });
    expect(res.body.suggestions[0].name).toBe("Streetlight");
    expect(res.body.possibleEmergency).toBe(false);
    const urgent = await t.api("POST", `${PUB_CR}/service-categories/suggest`, {
      json: { description: "There is smoke and a gas leak by the road" },
    });
    expect(urgent.body.possibleEmergency).toBe(true);
  });

  it("rejects invalid submissions with field-level errors", async () => {
    const res = await t.api("POST", `${PUB_CR}/service-requests`, {
      json: {
        categoryId: await categoryId(t.api, PUB_CR, "pothole"),
        description: "short",
        locationText: "",
      },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("validation_failed");
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path).sort()).toEqual([
      "description",
      "locationText",
    ]);
  });

  it("stores a valid request, routes it to the category's department and confirms to the resident", async () => {
    const before = t.email.sent.length;
    const made = await submitRequest(t, {
      reporterName: "Riley Brooks",
      reporterEmail: "riley@residents.example",
    });
    reference = made.reference;
    id = made.id;
    expect(reference).toMatch(/^CR-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(made.created).toMatchObject({
      status: "new",
      categoryName: "Pothole",
      departmentName: "Public Works",
      created: true,
    });
    const mail = t.email.sent.slice(before);
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: "riley@residents.example" });
    expect(mail[0]!.text).toContain(`http://site.test/cedar-ridge/requests/${reference}`);
  });

  it("is idempotent when the client retries with the same Idempotency-Key", async () => {
    const json = {
      categoryId: await categoryId(t.api, PUB_CR, "graffiti"),
      description: "Fresh graffiti on the skate park wall.",
      locationText: "Skate park",
    };
    const headers = { "idempotency-key": "retry-test-0001" };
    const [a, b] = await Promise.all([
      t.api("POST", `${PUB_CR}/service-requests`, { json, headers }),
      t.api("POST", `${PUB_CR}/service-requests`, { json, headers }),
    ]);
    const c = await t.api("POST", `${PUB_CR}/service-requests`, { json, headers });
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(c.status).toBe(200);
    expect(new Set([a.body.reference, b.body.reference, c.body.reference]).size).toBe(1);
  });

  it("notifies staff of the responsible department only", async () => {
    const pw = await t.api("GET", `${CR}/notifications`, { token: await t.login(USERS.crPwTech) });
    expect(pw.body.items.some((n: { subject: string }) => n.subject.includes(reference))).toBe(
      true,
    );
    const parks = await t.api("GET", `${CR}/notifications`, {
      token: await t.login(USERS.crParks),
    });
    expect(parks.body.items.some((n: { subject: string }) => n.subject.includes(reference))).toBe(
      false,
    );
  });

  it("shows the request in the department's queue with reporter contact for staff", async () => {
    const token = await t.login(USERS.crPwDirector);
    const list = await t.api("GET", `${CR}/service-requests?status=new`, { token });
    expect(list.body.items.map((r: { reference: string }) => r.reference)).toContain(reference);
    const detail = await t.api("GET", `${CR}/service-requests/${id}`, { token });
    expect(detail.body.reporter).toEqual({
      name: "Riley Brooks",
      email: "riley@residents.example",
      phone: null,
    });
    expect(detail.body.availableTransitions.map((x: { to: string }) => x.to)).toEqual([
      "reviewed",
      "closed",
    ]);
  });

  it("walks New -> Reviewed -> Assigned -> In Progress -> Resolved -> Closed", async () => {
    const director = await t.login(USERS.crPwDirector);
    const tech = await t.login(USERS.crPwTech);
    const status = (token: string, to: string, note?: string) =>
      t.api("POST", `${CR}/service-requests/${id}/status`, { token, json: { to, note } });

    expect((await status(director, "reviewed")).status).toBe(200);
    // "assigned" can only be reached by assigning someone.
    expect((await status(director, "assigned")).body.error.code).toBe("assignee_required");

    const assignable = await t.api("GET", `${CR}/service-requests/${id}/assignable-staff`, {
      token: director,
    });
    const priya = assignable.body.items.find((s: { name: string }) => s.name === "Priya Nair");
    expect(priya).toBeTruthy();
    // Parks staff cannot work a Public Works request, so they are not offered.
    expect(assignable.body.items.some((s: { name: string }) => s.name === "Tom Becker")).toBe(
      false,
    );
    expect(
      (
        await t.api("POST", `${CR}/service-requests/${id}/assign`, {
          token: director,
          json: { assigneeUserId: priya.id },
        })
      ).status,
    ).toBe(200);

    const mine = await t.api("GET", `${CR}/service-requests?assignee=me`, { token: tech });
    expect(mine.body.items.map((r: { reference: string }) => r.reference)).toContain(reference);
    const techNotes = await t.api("GET", `${CR}/notifications`, { token: tech });
    expect(techNotes.body.items[0].subject).toBe(`${reference} was assigned to you`);

    expect((await status(tech, "in_progress")).status).toBe(200);
    const before = t.email.sent.length;
    expect((await status(tech, "resolved", "Filled with hot mix this morning.")).status).toBe(200);
    expect(t.email.sent.slice(before)[0]).toMatchObject({ to: "riley@residents.example" });
    expect(t.email.sent.slice(before)[0]!.text).toContain("Filled with hot mix this morning.");

    // A technician may not close; the director may.
    expect((await status(tech, "closed")).status).toBe(403);
    expect((await status(director, "closed")).status).toBe(200);
  });

  it("rejects transitions the workflow does not define", async () => {
    const res = await t.api("POST", `${CR}/service-requests/${id}/status`, {
      token: await t.login(USERS.crPwDirector),
      json: { to: "resolved" },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_transition");
  });

  it("requires a note to reopen, then reopens", async () => {
    const token = await t.login(USERS.crPwDirector);
    const bare = await t.api("POST", `${CR}/service-requests/${id}/status`, {
      token,
      json: { to: "in_progress" },
    });
    expect(bare.body.error.code).toBe("note_required");
    const ok = await t.api("POST", `${CR}/service-requests/${id}/status`, {
      token,
      json: { to: "in_progress", note: "Patch failed after the storm." },
    });
    expect(ok.status).toBe(200);
    const detail = await t.api("GET", `${CR}/service-requests/${id}`, { token });
    expect(detail.body).toMatchObject({ status: "in_progress", resolvedAt: null, closedAt: null });
  });

  it("lets staff message the resident and keep internal notes private", async () => {
    const token = await t.login(USERS.crPwTech);
    await t.api("POST", `${CR}/service-requests/${id}/comments`, {
      token,
      json: { body: "Is the pothole in the bike lane?", visibility: "public" },
    });
    await t.api("POST", `${CR}/service-requests/${id}/comments`, {
      token,
      json: { body: "INTERNAL: third report on this block.", visibility: "internal" },
    });
    const reply = await t.api("POST", `${PUB_CR}/service-requests/${reference}/messages`, {
      json: { body: "Yes, right in the bike lane." },
    });
    expect(reply.status).toBe(201);
  });

  it("gives the resident a public timeline without private data", async () => {
    const res = await t.api("GET", `${PUB_CR}/service-requests/${reference.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
    const statuses = res.body.timeline
      .filter((e: { type: string }) => e.type !== "staff_message" && e.type !== "resident_message")
      .map((e: { toStatus: string }) => e.toStatus);
    expect(statuses).toEqual([
      "new",
      "reviewed",
      "assigned",
      "in_progress",
      "resolved",
      "closed",
      "in_progress",
    ]);
    const raw = JSON.stringify(res.body);
    expect(raw).toContain("Is the pothole in the bike lane?");
    expect(raw).toContain("Yes, right in the bike lane.");
    expect(raw).not.toContain("INTERNAL");
    expect(raw).not.toContain("riley@residents.example");
    expect(raw).not.toContain("Riley Brooks");
    expect(raw).not.toContain("Priya");
    expect(raw).not.toContain("Luis");
  });

  it("records the complete activity history for staff", async () => {
    const detail = await t.api("GET", `${CR}/service-requests/${id}`, {
      token: await t.login(USERS.crPwDirector),
    });
    const types = detail.body.events.map((e: { type: string }) => e.type);
    expect(types).toEqual([
      "created",
      "status_changed",
      "assigned",
      "status_changed",
      "status_changed",
      "status_changed",
      "status_changed",
      "status_changed",
      "staff_message",
      "staff_note",
      "resident_message",
    ]);
    const assigned = detail.body.events.find((e: { type: string }) => e.type === "assigned");
    expect(assigned).toMatchObject({
      actorName: "Luis Ortega",
      subjectName: "Priya Nair",
      visibility: "internal",
    });
  });

  it("writes audit events for every change, readable only with audit.read", async () => {
    const denied = await t.api("GET", `${CR}/audit-events`, {
      token: await t.login(USERS.crPwDirector),
    });
    expect(denied.status).toBe(403);
    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    expect(audit.status).toBe(200);
    const forRequest = audit.body.items
      .filter((e: { entityId: string }) => e.entityId === id)
      .map((e: { action: string }) => e.action);
    expect(forRequest).toEqual(
      expect.arrayContaining([
        "service_request.created",
        "service_request.status_changed",
        "service_request.assigned",
        "service_request.message_sent",
        "service_request.note_added",
        "service_request.resident_message_added",
      ]),
    );
    expect(forRequest.filter((a: string) => a === "service_request.status_changed")).toHaveLength(
      5,
    );
  });

  it("detects a concurrent status change instead of applying both", async () => {
    const made = await submitRequest(t);
    const token = await t.login(USERS.crPwDirector);
    const go = () =>
      t.api("POST", `${CR}/service-requests/${made.id}/status`, {
        token,
        json: { to: "reviewed" },
      });
    const results = await Promise.all([go(), go()]);
    expect(results.map((r) => r.status).sort()).not.toEqual([200, 200]);
    const detail = await t.api("GET", `${CR}/service-requests/${made.id}`, { token });
    expect(
      detail.body.events.filter((e: { type: string }) => e.type === "status_changed"),
    ).toHaveLength(1);
  });

  it("flags possible duplicates for staff review", async () => {
    const a = await submitRequest(t, {
      locationText: "12 Duplicate Way",
      latitude: 40.7,
      longitude: -111.6,
    });
    const b = await submitRequest(t, {
      locationText: "Near 12 Duplicate Way",
      latitude: 40.7002,
      longitude: -111.6002,
    });
    const detail = await t.api("GET", `${CR}/service-requests/${b.id}`, {
      token: await t.login(USERS.crAdmin),
    });
    expect(detail.body.possibleDuplicates.map((d: { reference: string }) => d.reference)).toContain(
      a.reference,
    );
  });

  it("serves a role-aware dashboard", async () => {
    const tech = await t.api("GET", `${CR}/dashboard`, { token: await t.login(USERS.crPwTech) });
    expect(tech.body.hasRequestAccess).toBe(true);
    expect(
      tech.body.myQueue.every(
        (r: { assignee: { name: string } }) => r.assignee.name === "Priya Nair",
      ),
    ).toBe(true);
    expect(tech.body.metrics.open).toBeGreaterThan(0);
  });
});
