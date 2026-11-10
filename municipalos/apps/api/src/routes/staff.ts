import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  and,
  asc,
  auditEvents,
  count,
  departments,
  desc,
  eq,
  isNull,
  notifications,
  users,
  withTenant,
} from "@municipalos/database";
import {
  changeStatusSchema,
  listServiceRequestsQuerySchema,
  paginationQuerySchema,
  staffCommentSchema,
} from "@municipalos/validation";
import type { Context } from "hono";
import type { AppDeps, AppEnv } from "../context";
import { notFound } from "../errors";
import { assertCan, requireSession, requireStaff } from "../middleware/auth";
import {
  auditEventSchema,
  body,
  dashboardSchema,
  errorResponses,
  idParam,
  json,
  notificationSchema,
  okSchema,
  paginationSchema,
  requestDetailSchema,
  requestListItemSchema,
  slugParam,
  staffMeSchema,
} from "../schemas";
import {
  addStaffComment,
  assignRequest,
  changeStatus,
  getDashboard,
  getRequestDetail,
  listAssignableStaff,
  listRequests,
} from "../services/service-requests";
import { validationHook } from "../validation-hook";

const tags = ["Staff"];
const security = [{ bearerAuth: [] }];
const ok = { ok: true as const };

export function staffRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  // Every staff route: valid session, then verified membership in the municipality in the URL.
  app.use("/:slug/*", requireSession(deps), requireStaff(deps));

  const ctx = (c: Context<AppEnv>) => ({
    staff: c.get("staff"),
    userId: c.get("auth").user.id,
    meta: { ip: c.get("ip"), requestId: c.get("requestId") },
  });
  const tenant = (c: Context<AppEnv>) => ({
    municipalityId: c.get("staff").municipality.id,
    userId: c.get("auth").user.id,
  });

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/me",
      tags,
      security,
      summary: "The caller's membership and permissions in this municipality",
      request: { params: slugParam },
      responses: { 200: json(staffMeSchema, "Membership"), ...errorResponses },
    }),
    async (c) => {
      const { staff, userId } = ctx(c);
      const { user } = c.get("auth");
      const [unread] = await withTenant(deps.db, tenant(c), (tx) =>
        tx
          .select({ value: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.recipientUserId, userId),
              eq(notifications.channel, "in_app"),
              isNull(notifications.readAt),
            ),
          ),
      );
      const m = staff.municipality;
      return c.json(
        {
          user: { id: user.id, email: user.email, name: user.name },
          municipality: { slug: m.slug, name: m.name, state: m.state },
          membership: {
            title: staff.membership.title,
            roleKey: staff.membership.roleKey,
            roleName: staff.membership.roleName,
            departmentId: staff.membership.departmentId,
          },
          permissions: [...staff.permissions],
          unreadNotifications: unread?.value ?? 0,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/dashboard",
      tags,
      security,
      summary: "Role-aware work queue and metrics",
      request: { params: slugParam },
      responses: { 200: json(dashboardSchema, "Dashboard"), ...errorResponses },
    }),
    async (c) => {
      const { staff, userId } = ctx(c);
      return c.json(await getDashboard(deps, staff, userId), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/departments",
      tags,
      security,
      summary: "Departments of the municipality",
      request: { params: slugParam },
      responses: {
        200: json(
          z.object({ items: z.array(z.object({ id: z.string(), name: z.string() })) }),
          "Departments",
        ),
        ...errorResponses,
      },
    }),
    async (c) => {
      const items = await withTenant(deps.db, tenant(c), (tx) =>
        tx
          .select({ id: departments.id, name: departments.name })
          .from(departments)
          .orderBy(asc(departments.sortOrder)),
      );
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/service-requests",
      tags,
      security,
      summary: "List service requests visible to the caller",
      request: { params: slugParam, query: listServiceRequestsQuerySchema },
      responses: {
        200: json(
          z.object({ items: z.array(requestListItemSchema), pagination: paginationSchema }),
          "Requests",
        ),
        ...errorResponses,
      },
    }),
    async (c) => {
      const { staff, userId } = ctx(c);
      return c.json(await listRequests(deps, staff, userId, c.req.valid("query")), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/service-requests/{id}",
      tags,
      security,
      summary: "Request detail with full history",
      request: { params: idParam },
      responses: { 200: json(requestDetailSchema, "Request"), ...errorResponses },
    }),
    async (c) => {
      const { staff, userId } = ctx(c);
      return c.json(await getRequestDetail(deps, staff, userId, c.req.valid("param").id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/service-requests/{id}/status",
      tags,
      security,
      summary: "Move a request to another workflow state",
      request: { params: idParam, body: body(changeStatusSchema) },
      responses: { 200: json(okSchema, "Status changed"), ...errorResponses },
    }),
    async (c) => {
      const { staff, userId, meta } = ctx(c);
      await changeStatus(deps, staff, userId, c.req.valid("param").id, c.req.valid("json"), meta);
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/service-requests/{id}/assignable-staff",
      tags,
      security,
      summary: "Staff who may be assigned to this request",
      request: { params: idParam },
      responses: {
        200: json(
          z.object({
            items: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                title: z.string().nullable(),
                roleName: z.string(),
              }),
            ),
          }),
          "Assignable staff",
        ),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "service_requests.assign");
      const { staff, userId } = ctx(c);
      return c.json(
        { items: await listAssignableStaff(deps, staff, userId, c.req.valid("param").id) },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/service-requests/{id}/assign",
      tags,
      security,
      summary: "Assign (or reassign) a request",
      request: { params: idParam, body: body(z.object({ assigneeUserId: z.uuid() })) },
      responses: { 200: json(okSchema, "Assigned"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "service_requests.assign");
      const { staff, userId, meta } = ctx(c);
      await assignRequest(
        deps,
        staff,
        userId,
        c.req.valid("param").id,
        c.req.valid("json").assigneeUserId,
        meta,
      );
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/service-requests/{id}/comments",
      tags,
      security,
      summary: "Add an internal note or a resident-visible message",
      request: { params: idParam, body: body(staffCommentSchema) },
      responses: { 201: json(okSchema, "Comment added"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "service_requests.comment");
      const { staff, userId, meta } = ctx(c);
      await addStaffComment(
        deps,
        staff,
        userId,
        c.req.valid("param").id,
        c.req.valid("json"),
        meta,
      );
      return c.json(ok, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/notifications",
      tags,
      security,
      summary: "The caller's in-app notifications",
      request: { params: slugParam },
      responses: {
        200: json(z.object({ items: z.array(notificationSchema) }), "Notifications"),
        ...errorResponses,
      },
    }),
    async (c) => {
      const { userId } = ctx(c);
      const rows = await withTenant(deps.db, tenant(c), (tx) =>
        tx
          .select()
          .from(notifications)
          .where(
            and(eq(notifications.recipientUserId, userId), eq(notifications.channel, "in_app")),
          )
          .orderBy(desc(notifications.createdAt))
          .limit(30),
      );
      return c.json(
        {
          items: rows.map((n) => ({
            id: n.id,
            subject: n.subject,
            body: n.body,
            entityType: n.entityType,
            entityId: n.entityId,
            createdAt: n.createdAt.toISOString(),
            readAt: n.readAt?.toISOString() ?? null,
          })),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/notifications/read",
      tags,
      security,
      summary: "Mark one or all of the caller's notifications as read",
      request: { params: slugParam, body: body(z.object({ id: z.uuid().optional() })) },
      responses: { 200: json(okSchema, "Marked read"), ...errorResponses },
    }),
    async (c) => {
      const { userId } = ctx(c);
      const { id } = c.req.valid("json");
      const updated = await withTenant(deps.db, tenant(c), (tx) =>
        tx
          .update(notifications)
          .set({ readAt: new Date() })
          .where(
            and(
              // Only ever the caller's own notifications.
              eq(notifications.recipientUserId, userId),
              isNull(notifications.readAt),
              id ? eq(notifications.id, id) : undefined,
            ),
          )
          .returning({ id: notifications.id }),
      );
      if (id && updated.length === 0) throw notFound("Notification");
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/audit-events",
      tags,
      security,
      summary: "Audit log for the municipality",
      request: { params: slugParam, query: paginationQuerySchema },
      responses: {
        200: json(
          z.object({ items: z.array(auditEventSchema), pagination: paginationSchema }),
          "Audit events",
        ),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "audit.read");
      const { page, pageSize } = c.req.valid("query");
      const result = await withTenant(deps.db, tenant(c), async (tx) => {
        const [total] = await tx.select({ value: count() }).from(auditEvents);
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            actorKind: auditEvents.actorKind,
            actorName: users.name,
            entityType: auditEvents.entityType,
            entityId: auditEvents.entityId,
            metadata: auditEvents.metadata,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .leftJoin(users, eq(users.id, auditEvents.actorUserId))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize);
        return { rows, total: total?.value ?? 0 };
      });
      return c.json(
        {
          items: result.rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
          pagination: { page, pageSize, total: result.total },
        },
        200,
      );
    },
  );

  return app;
}
