/**
 * Resident email delivery: failures never break the request, are retried with backoff, and
 * end in a visible "failed" state instead of disappearing.
 */
import { eq, schema, sql, withTenant } from "@municipalos/database";
import type { EmailMessage, EmailTransport } from "@municipalos/notifications";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { DEFAULT_RATE_LIMITS } from "../src/context";
import { MemoryStorage } from "../src/lib/storage";
import { MAX_EMAIL_ATTEMPTS, processOutbox, retryDelayMs } from "../src/services/notify";
import { PUB_CR, categoryId, createTestApp, type TestApp } from "./helpers";

class FlakyTransport implements EmailTransport {
  readonly name = "flaky";
  readonly sent: EmailMessage[] = [];
  failing = true;
  attempts = 0;
  async send(message: EmailMessage): Promise<void> {
    this.attempts += 1;
    if (this.failing) throw new Error("smtp: connection refused (simulated)");
    this.sent.push(message);
  }
}

let t: TestApp;
const transport = new FlakyTransport();
let deps: Parameters<typeof createApp>[0];
let crId: string;

const { notifications } = schema;
const emailsTo = (address: string) =>
  withTenant(t.handle.db, { municipalityId: crId }, (tx) =>
    tx.select().from(notifications).where(eq(notifications.recipientEmail, address)),
  );
const makeDue = (address: string) =>
  withTenant(t.handle.db, { municipalityId: crId }, (tx) =>
    tx
      .update(notifications)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(notifications.recipientEmail, address)),
  );

beforeAll(async () => {
  t = await createTestApp();
  const [cr] = await t.handle.db
    .select()
    .from(schema.municipalities)
    .where(sql`slug = 'cedar-ridge'`);
  crId = cr!.id;
  deps = {
    db: t.handle.db,
    email: transport,
    storage: new MemoryStorage(),
    config: {
      sessionTtlHours: 1,
      sessionIdleMinutes: 30,
      publicSiteUrl: "http://site.test",
      rateLimits: { ...DEFAULT_RATE_LIMITS, publicSubmit: { limit: 1000, windowMs: 60_000 } },
    },
  };
  // Drain anything queued by other test files so counts below are about this file only.
  transport.failing = false;
  await processOutbox(deps);
  transport.sent.length = 0;
  transport.failing = true;
});
afterAll(() => t.close());

async function submit(address: string) {
  const app = createApp(deps);
  const res = await app.request(`${PUB_CR}/service-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      categoryId: await categoryId(t.api, PUB_CR, "pothole"),
      description: "Outbox test pothole near the depot.",
      locationText: "1 Depot Rd",
      reporterEmail: address,
    }),
  });
  return res.status;
}

describe("email outbox", () => {
  it("accepts the request even when email delivery fails, and schedules a retry", async () => {
    expect(await submit("retry@residents.example")).toBe(201);
    const [row] = await emailsTo("retry@residents.example");
    expect(row).toMatchObject({ status: "queued", attempts: 1 });
    expect(row!.lastError).toContain("connection refused");
    expect(row!.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not retry before the backoff has elapsed", async () => {
    const before = transport.attempts;
    expect(await processOutbox(deps)).toEqual({ sent: 0, retrying: 0, failed: 0 });
    expect(transport.attempts).toBe(before);
  });

  it("delivers on a later pass once the provider recovers, exactly once", async () => {
    await makeDue("retry@residents.example");
    transport.failing = false;
    const [a, b] = await Promise.all([processOutbox(deps), processOutbox(deps)]);
    expect(a.sent + b.sent).toBe(1);
    expect(transport.sent.filter((m) => m.to === "retry@residents.example")).toHaveLength(1);
    const [row] = await emailsTo("retry@residents.example");
    expect(row).toMatchObject({
      status: "sent",
      attempts: 2,
      lastError: null,
      nextAttemptAt: null,
    });
    expect(row!.sentAt).toBeInstanceOf(Date);
  });

  it("gives up after the maximum number of attempts and records why", async () => {
    transport.failing = true;
    expect(await submit("dead@residents.example")).toBe(201);
    for (let i = 1; i < MAX_EMAIL_ATTEMPTS; i++) {
      await makeDue("dead@residents.example");
      await processOutbox(deps);
    }
    const [row] = await emailsTo("dead@residents.example");
    expect(row).toMatchObject({
      status: "failed",
      attempts: MAX_EMAIL_ATTEMPTS,
      nextAttemptAt: null,
    });
    expect(row!.lastError).toContain("simulated");
    const before = transport.attempts;
    await processOutbox(deps);
    expect(transport.attempts).toBe(before);
  });

  it("backs off progressively", () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelayMs).map((ms) => ms / 60_000)).toEqual([
      1, 5, 25, 120, 360, 360,
    ]);
  });
});
