/**
 * Records management: exporting complete records (public records requests, audits) and the
 * audit log. Registered on the staff router, behind session and membership checks.
 */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import {
  alias,
  and,
  asc,
  auditEvents,
  departments,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  legalHolds,
  lte,
  notifications,
  retentionPolicies,
  sql,
  serviceRequestAttachments as attachments,
  serviceRequestCategories as categories,
  serviceRequestEvents as events,
  serviceRequests as requests,
  users,
  withTenant,
} from "@municipalos/database";
import { serviceRequestVisibility } from "@municipalos/permissions";
import type { Context } from "hono";
import type { AppDeps, AppEnv } from "../context";
import { conflict, notFound, unprocessable } from "../errors";
import { recordAudit } from "../lib/audit";
import { assertCan } from "../middleware/auth";
import { body, errorResponses, idParam, json, okSchema, slugParam } from "../schemas";

const tags = ["Records"];
const security = [{ bearerAuth: [] }];
const MAX_AUDIT_EXPORT_ROWS = 50_000;

/** Quotes a CSV cell and neutralises spreadsheet formulas (=, +, -, @ at the start). */
export function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function registerStaffRecordsRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps) {
  const tenant = (c: Context<AppEnv>) => ({
    municipalityId: c.get("staff").municipality.id,
    userId: c.get("auth").user.id,
  });
  const auditBase = (c: Context<AppEnv>) => ({
    municipalityId: c.get("staff").municipality.id,
    actorKind: "staff" as const,
    actorUserId: c.get("auth").user.id,
    ip: c.get("ip"),
    requestId: c.get("requestId"),
  });
  const download = (c: Context<AppEnv>, body: string, type: string, filename: string) =>
    c.body(body, 200, {
      "Content-Type": `${type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    });

  app.openAPIRegistry.registerPath({
    method: "get",
    path: "/v1/staff/{slug}/service-requests/{id}/export",
    tags,
    security,
    summary: "Export the complete record of one service request as JSON",
    description:
      "Includes reporter contact details, internal notes, the full history, photo metadata and notification delivery records. Requires `records.export`; every export is audited. Whether a record or part of it may be released is the municipality's legal decision — this endpoint only assembles it.",
    request: { params: idParam },
    responses: {
      200: {
        description: "The record",
        content: { "application/json": { schema: z.object({}).passthrough() } },
      },
      ...errorResponses,
    },
  });
  app.get("/:slug/service-requests/:id/export", async (c) => {
    assertCan(c, "records.export");
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success) throw notFound("Request");
    const staff = c.get("staff");
    const { user } = c.get("auth");

    // Exporting never widens what a person may see: department-scoped roles stay scoped.
    const visibility = serviceRequestVisibility(staff.permissions, staff.membership.departmentId);
    if (visibility.scope === "none") throw notFound("Request");
    const scope =
      visibility.scope === "department"
        ? eq(requests.departmentId, visibility.departmentId)
        : undefined;

    const record = await withTenant(deps.db, tenant(c), async (tx) => {
      const assignee = alias(users, "assignee");
      const [row] = await tx
        .select({
          request: requests,
          categoryName: categories.name,
          departmentName: departments.name,
          assigneeName: assignee.name,
        })
        .from(requests)
        .innerJoin(categories, eq(categories.id, requests.categoryId))
        .innerJoin(departments, eq(departments.id, requests.departmentId))
        .leftJoin(assignee, eq(assignee.id, requests.assignedToUserId))
        .where(and(eq(requests.id, id), scope));
      if (!row) throw notFound("Request");

      const actor = alias(users, "actor");
      const subject = alias(users, "subject");
      const history = await tx
        .select({
          sequence: events.seq,
          at: events.createdAt,
          type: events.type,
          visibility: events.visibility,
          fromStatus: events.fromStatus,
          toStatus: events.toStatus,
          body: events.body,
          actorKind: events.actorKind,
          actorName: actor.name,
          subjectName: subject.name,
        })
        .from(events)
        .leftJoin(actor, eq(actor.id, events.actorUserId))
        .leftJoin(subject, eq(subject.id, events.subjectUserId))
        .where(eq(events.requestId, id))
        .orderBy(asc(events.seq));
      const photos = await tx
        .select({
          id: attachments.id,
          kind: attachments.kind,
          contentType: attachments.contentType,
          sizeBytes: attachments.sizeBytes,
          uploadedByKind: attachments.uploadedByKind,
          createdAt: attachments.createdAt,
        })
        .from(attachments)
        .where(eq(attachments.requestId, id))
        .orderBy(asc(attachments.createdAt));
      const messages = await tx
        .select({
          channel: notifications.channel,
          to: notifications.recipientEmail,
          subject: notifications.subject,
          body: notifications.body,
          status: notifications.status,
          createdAt: notifications.createdAt,
          sentAt: notifications.sentAt,
        })
        .from(notifications)
        .where(and(eq(notifications.entityId, id), eq(notifications.channel, "email")))
        .orderBy(asc(notifications.createdAt));

      await recordAudit(tx, {
        ...auditBase(c),
        action: "record.exported",
        entityType: "service_request",
        entityId: id,
        metadata: { reference: row.request.reference, format: "json" },
      });

      const r = row.request;
      return {
        exportedAt: new Date().toISOString(),
        exportedBy: user.name,
        municipality: { name: staff.municipality.name, state: staff.municipality.state },
        recordType: "service_request",
        notice:
          "Contains personal information and internal notes. Review for exemptions before release.",
        request: {
          reference: r.reference,
          status: r.status,
          category: row.categoryName,
          department: row.departmentName,
          description: r.description,
          location: r.locationText,
          latitude: r.latitude,
          longitude: r.longitude,
          reporter: { name: r.reporterName, email: r.reporterEmail, phone: r.reporterPhone },
          assignedTo: row.assigneeName,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          resolvedAt: r.resolvedAt,
          closedAt: r.closedAt,
        },
        history,
        photos,
        emailsToResident: messages,
      };
    });
    return download(
      c,
      JSON.stringify(record, null, 2),
      "application/json",
      `${record.request.reference}.json`,
    );
  });

  app.openAPIRegistry.registerPath({
    method: "get",
    path: "/v1/staff/{slug}/audit-events/export",
    tags,
    security,
    summary: "Export the audit log as CSV",
    request: {
      params: slugParam,
      query: z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }),
    },
    responses: {
      200: { description: "CSV file", content: { "text/csv": { schema: z.string() } } },
      ...errorResponses,
    },
  });
  app.get("/:slug/audit-events/export", async (c) => {
    assertCan(c, "audit.read");
    const parsed = z
      .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
      .safeParse(c.req.query());
    if (!parsed.success) throw notFound("Export");
    const from = parsed.data.from ? new Date(`${parsed.data.from}T00:00:00Z`) : undefined;
    const to = parsed.data.to ? new Date(`${parsed.data.to}T23:59:59.999Z`) : undefined;

    const rows = await withTenant(deps.db, tenant(c), async (tx) => {
      const result = await tx
        .select({
          at: auditEvents.createdAt,
          action: auditEvents.action,
          actorKind: auditEvents.actorKind,
          actorName: users.name,
          entityType: auditEvents.entityType,
          entityId: auditEvents.entityId,
          metadata: auditEvents.metadata,
          ip: auditEvents.ip,
          requestId: auditEvents.requestId,
        })
        .from(auditEvents)
        .leftJoin(users, eq(users.id, auditEvents.actorUserId))
        .where(
          and(
            from ? gte(auditEvents.createdAt, from) : undefined,
            to ? lte(auditEvents.createdAt, to) : undefined,
          ),
        )
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(MAX_AUDIT_EXPORT_ROWS);
      await recordAudit(tx, {
        ...auditBase(c),
        action: "audit.exported",
        metadata: {
          from: parsed.data.from ?? null,
          to: parsed.data.to ?? null,
          rows: result.length,
        },
      });
      return result;
    });

    const header = [
      "time_utc",
      "action",
      "actor_kind",
      "actor_name",
      "entity_type",
      "entity_id",
      "details",
      "client_address",
      "request_id",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.at.toISOString(),
          r.action,
          r.actorKind,
          r.actorName,
          r.entityType,
          r.entityId,
          r.metadata,
          r.ip,
          r.requestId,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return download(
      c,
      lines.join("\r\n") + "\r\n",
      "text/csv",
      `audit-log-${staff(c)}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  });

  /* ───────────── Retention schedule ───────────── */

  const policySchema = z
    .object({
      recordType: z.literal("service_request"),
      retentionDays: z.number().nullable(),
      authority: z.string().nullable(),
      updatedAt: z.string().nullable(),
      updatedByName: z.string().nullable(),
    })
    .openapi("RetentionPolicy");

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/records/retention",
      tags,
      security,
      summary: "The municipality's retention schedule",
      description: "A record type with no period set is kept permanently.",
      request: { params: slugParam },
      responses: {
        200: json(z.object({ items: z.array(policySchema) }), "Schedule"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "records.manage");
      const rows = await withTenant(deps.db, tenant(c), (tx) =>
        tx
          .select({
            recordType: retentionPolicies.recordType,
            retentionDays: retentionPolicies.retentionDays,
            authority: retentionPolicies.authority,
            updatedAt: retentionPolicies.updatedAt,
            updatedByName: users.name,
          })
          .from(retentionPolicies)
          .leftJoin(users, eq(users.id, retentionPolicies.updatedByUserId)),
      );
      const existing = rows.find((r) => r.recordType === "service_request");
      return c.json(
        {
          items: [
            existing
              ? { ...existing, updatedAt: existing.updatedAt.toISOString() }
              : {
                  recordType: "service_request" as const,
                  retentionDays: null,
                  authority: null,
                  updatedAt: null,
                  updatedByName: null,
                },
          ],
        },
        200,
      );
    },
  );

  const policyInput = z.object({
    retentionDays: z.number().int().min(30).max(36_500).nullable(),
    authority: z.string().trim().min(3).max(300),
  });

  app.openapi(
    createRoute({
      method: "put",
      path: "/{slug}/records/retention/service_request",
      tags,
      security,
      summary: "Set how long closed service requests are kept, and the legal authority for it",
      description:
        "`retentionDays: null` keeps records permanently. Changing the schedule never dispositions anything by itself.",
      request: { params: slugParam, body: body(policyInput) },
      responses: { 200: json(okSchema, "Saved"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "records.manage");
      const input = c.req.valid("json");
      const t = tenant(c);
      await withTenant(deps.db, t, async (tx) => {
        const [before] = await tx
          .select()
          .from(retentionPolicies)
          .where(eq(retentionPolicies.recordType, "service_request"));
        if (before) {
          await tx
            .update(retentionPolicies)
            .set({
              retentionDays: input.retentionDays,
              authority: input.authority,
              updatedByUserId: t.userId,
              updatedAt: new Date(),
            })
            .where(eq(retentionPolicies.id, before.id));
        } else {
          await tx.insert(retentionPolicies).values({
            municipalityId: t.municipalityId,
            recordType: "service_request",
            retentionDays: input.retentionDays,
            authority: input.authority,
            updatedByUserId: t.userId,
          });
        }
        await recordAudit(tx, {
          ...auditBase(c),
          action: "records.retention_changed",
          entityType: "retention_policy",
          metadata: {
            recordType: "service_request",
            beforeDays: before?.retentionDays ?? null,
            afterDays: input.retentionDays,
            authority: input.authority,
          },
        });
      });
      return c.json({ ok: true as const }, 200);
    },
  );

  /* ───────────── Legal holds ───────────── */

  const holdSchema = z
    .object({
      id: z.string(),
      reason: z.string(),
      placedByName: z.string().nullable(),
      placedAt: z.string(),
      releasedByName: z.string().nullable(),
      releasedAt: z.string().nullable(),
      releaseNote: z.string().nullable(),
    })
    .openapi("LegalHold");

  /** Loads a request the caller may see, locking it so holds and disposition cannot interleave. */
  async function lockVisibleRequest(
    tx: Parameters<Parameters<typeof withTenant>[2]>[0],
    c: Context<AppEnv>,
    id: string,
  ) {
    const s = c.get("staff");
    const visibility = serviceRequestVisibility(s.permissions, s.membership.departmentId);
    if (visibility.scope === "none") throw notFound("Request");
    const [row] = await tx
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.id, id),
          visibility.scope === "department"
            ? eq(requests.departmentId, visibility.departmentId)
            : undefined,
        ),
      )
      .for("update");
    if (!row) throw notFound("Request");
    return row;
  }

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/service-requests/{id}/holds",
      tags,
      security,
      summary: "Legal holds on a request, including released ones",
      request: { params: idParam },
      responses: {
        200: json(z.object({ items: z.array(holdSchema) }), "Holds"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "records.manage");
      const { id } = c.req.valid("param");
      const placer = alias(users, "placer");
      const releaser = alias(users, "releaser");
      const rows = await withTenant(deps.db, tenant(c), async (tx) => {
        await lockVisibleRequest(tx, c, id);
        return tx
          .select({
            id: legalHolds.id,
            reason: legalHolds.reason,
            placedByName: placer.name,
            placedAt: legalHolds.placedAt,
            releasedByName: releaser.name,
            releasedAt: legalHolds.releasedAt,
            releaseNote: legalHolds.releaseNote,
          })
          .from(legalHolds)
          .leftJoin(placer, eq(placer.id, legalHolds.placedByUserId))
          .leftJoin(releaser, eq(releaser.id, legalHolds.releasedByUserId))
          .where(and(eq(legalHolds.recordType, "service_request"), eq(legalHolds.recordId, id)))
          .orderBy(desc(legalHolds.placedAt));
      });
      return c.json(
        {
          items: rows.map((h) => ({
            ...h,
            placedAt: h.placedAt.toISOString(),
            releasedAt: h.releasedAt?.toISOString() ?? null,
          })),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/service-requests/{id}/holds",
      tags,
      security,
      summary:
        "Place a legal hold: the record cannot be dispositioned until every hold is released",
      request: {
        params: idParam,
        body: body(z.object({ reason: z.string().trim().min(5).max(500) })),
      },
      responses: { 201: json(z.object({ id: z.string() }), "Hold placed"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "records.manage");
      const { id } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const t = tenant(c);
      const holdId = await withTenant(deps.db, t, async (tx) => {
        const request = await lockVisibleRequest(tx, c, id);
        if (request.dispositionedAt)
          throw conflict("already_dispositioned", "This record has already been dispositioned.");
        const [hold] = await tx
          .insert(legalHolds)
          .values({
            municipalityId: t.municipalityId,
            recordType: "service_request",
            recordId: id,
            reason,
            placedByUserId: t.userId,
          })
          .returning({ id: legalHolds.id });
        await tx.insert(events).values({
          municipalityId: t.municipalityId,
          requestId: id,
          type: "legal_hold_placed",
          visibility: "internal",
          body: reason,
          actorKind: "staff",
          actorUserId: t.userId,
        });
        await recordAudit(tx, {
          ...auditBase(c),
          action: "records.legal_hold_placed",
          entityType: "service_request",
          entityId: id,
          metadata: { reference: request.reference, holdId: hold!.id },
        });
        return hold!.id;
      });
      return c.json({ id: holdId }, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/records/holds/{id}/release",
      tags,
      security,
      summary: "Release a legal hold",
      request: {
        params: idParam,
        body: body(z.object({ note: z.string().trim().min(5).max(500) })),
      },
      responses: { 200: json(okSchema, "Released"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "records.manage");
      const { id } = c.req.valid("param");
      const { note } = c.req.valid("json");
      const t = tenant(c);
      await withTenant(deps.db, t, async (tx) => {
        const [hold] = await tx
          .select()
          .from(legalHolds)
          .where(eq(legalHolds.id, id))
          .for("update");
        if (!hold) throw notFound("Legal hold");
        const request = await lockVisibleRequest(tx, c, hold.recordId);
        if (hold.releasedAt)
          throw conflict("already_released", "This hold has already been released.");
        await tx
          .update(legalHolds)
          .set({ releasedByUserId: t.userId, releasedAt: new Date(), releaseNote: note })
          .where(eq(legalHolds.id, id));
        await tx.insert(events).values({
          municipalityId: t.municipalityId,
          requestId: request.id,
          type: "legal_hold_released",
          visibility: "internal",
          body: note,
          actorKind: "staff",
          actorUserId: t.userId,
        });
        await recordAudit(tx, {
          ...auditBase(c),
          action: "records.legal_hold_released",
          entityType: "service_request",
          entityId: request.id,
          metadata: { reference: request.reference, holdId: id },
        });
      });
      return c.json({ ok: true as const }, 200);
    },
  );

  /* ───────────── Disposition ───────────── */

  const activeHold = sql<boolean>`exists (select 1 from ${legalHolds} h where h.record_type = 'service_request' and h.record_id = ${requests.id} and h.released_at is null)`;

  const dispositionSchema = z
    .object({
      retentionDays: z.number().nullable(),
      eligible: z.array(
        z.object({
          id: z.string(),
          reference: z.string(),
          categoryName: z.string(),
          closedAt: z.string(),
          eligibleSince: z.string(),
        }),
      ),
      onHold: z.number(),
      dispositioned: z.number(),
    })
    .openapi("DispositionReview");

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/records/disposition",
      tags,
      security,
      summary: "Closed requests whose retention period has passed and that are not on hold",
      description:
        "A review list only. Nothing is dispositioned until an authorized person confirms specific records.",
      request: { params: slugParam },
      responses: { 200: json(dispositionSchema, "Review list"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "records.manage");
      const result = await withTenant(deps.db, tenant(c), async (tx) => {
        const [policy] = await tx
          .select()
          .from(retentionPolicies)
          .where(eq(retentionPolicies.recordType, "service_request"));
        const [done] = await tx
          .select({ value: sql<number>`count(*)::int` })
          .from(requests)
          .where(sql`${requests.dispositionedAt} is not null`);
        const days = policy?.retentionDays ?? null;
        if (days === null)
          return { retentionDays: null, eligible: [], onHold: 0, dispositioned: done?.value ?? 0 };
        const cutoff = new Date(Date.now() - days * 86_400_000);
        const past = and(
          eq(requests.status, "closed"),
          lte(requests.closedAt, cutoff),
          isNull(requests.dispositionedAt),
        );
        const eligible = await tx
          .select({
            id: requests.id,
            reference: requests.reference,
            categoryName: categories.name,
            closedAt: requests.closedAt,
          })
          .from(requests)
          .innerJoin(categories, eq(categories.id, requests.categoryId))
          .where(and(past, sql`not ${activeHold}`))
          .orderBy(asc(requests.closedAt))
          .limit(200);
        const [held] = await tx
          .select({ value: sql<number>`count(*)::int` })
          .from(requests)
          .where(and(past, activeHold));
        return {
          retentionDays: days,
          eligible: eligible.map((r) => ({
            id: r.id,
            reference: r.reference,
            categoryName: r.categoryName,
            closedAt: r.closedAt!.toISOString(),
            eligibleSince: new Date(r.closedAt!.getTime() + days * 86_400_000).toISOString(),
          })),
          onHold: held?.value ?? 0,
          dispositioned: done?.value ?? 0,
        };
      });
      return c.json(result, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/records/disposition",
      tags,
      security,
      summary: "Disposition specific records: permanently redact the reporter's personal data",
      description:
        "Each record is re-checked: it must be closed, past the retention period, not on legal hold and not already dispositioned. The request's non-personal history is kept. This cannot be undone.",
      request: {
        params: slugParam,
        body: body(
          z.object({ requestIds: z.array(z.uuid()).min(1).max(100), confirm: z.literal(true) }),
        ),
      },
      responses: {
        200: json(
          z.object({
            dispositioned: z.array(z.string()),
            skipped: z.array(z.object({ id: z.string(), reason: z.string() })),
          }),
          "Outcome per record",
        ),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "records.manage");
      const ids = [...new Set(c.req.valid("json").requestIds)];
      const t = tenant(c);
      const outcome = await withTenant(deps.db, t, async (tx) => {
        const [policy] = await tx
          .select()
          .from(retentionPolicies)
          .where(eq(retentionPolicies.recordType, "service_request"));
        if (!policy || policy.retentionDays === null)
          throw unprocessable(
            "no_retention_period",
            "Set a retention period before dispositioning records.",
          );
        const cutoff = new Date(Date.now() - policy.retentionDays * 86_400_000);
        const rows = await tx
          .select()
          .from(requests)
          .where(inArray(requests.id, ids))
          .for("update");
        const held = await tx
          .select({ recordId: legalHolds.recordId })
          .from(legalHolds)
          .where(
            and(
              eq(legalHolds.recordType, "service_request"),
              inArray(legalHolds.recordId, ids),
              isNull(legalHolds.releasedAt),
            ),
          );
        const onHold = new Set(held.map((h) => h.recordId));
        const dispositioned: string[] = [];
        const skipped: { id: string; reason: string }[] = [];
        for (const id of ids) {
          const r = rows.find((x) => x.id === id);
          const reason = !r
            ? "not_found"
            : r.dispositionedAt
              ? "already_dispositioned"
              : onHold.has(id)
                ? "legal_hold"
                : r.status !== "closed" || !r.closedAt
                  ? "not_closed"
                  : r.closedAt > cutoff
                    ? "retention_period_not_passed"
                    : null;
          if (reason || !r) {
            skipped.push({ id, reason: reason ?? "not_found" });
            continue;
          }
          const now = new Date();
          await tx
            .update(requests)
            .set({
              reporterName: null,
              reporterEmail: null,
              reporterPhone: null,
              dispositionedAt: now,
              updatedAt: now,
            })
            .where(eq(requests.id, id));
          await tx
            .update(notifications)
            .set({ recipientEmail: "[redacted]", body: "[redacted under retention schedule]" })
            .where(and(eq(notifications.entityId, id), eq(notifications.channel, "email")));
          await tx.insert(events).values({
            municipalityId: t.municipalityId,
            requestId: id,
            type: "dispositioned",
            visibility: "internal",
            body: `Personal data redacted under the retention schedule (${policy.authority}).`,
            actorKind: "staff",
            actorUserId: t.userId,
          });
          await recordAudit(tx, {
            ...auditBase(c),
            action: "records.dispositioned",
            entityType: "service_request",
            entityId: id,
            metadata: {
              reference: r.reference,
              retentionDays: policy.retentionDays,
              authority: policy.authority,
              closedAt: r.closedAt?.toISOString() ?? null,
            },
          });
          dispositioned.push(id);
        }
        return { dispositioned, skipped };
      });
      return c.json(outcome, 200);
    },
  );

  function staff(c: Context<AppEnv>): string {
    return c.get("staff").municipality.slug;
  }
}
