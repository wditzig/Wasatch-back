import {
  and, asc, count, desc, eq, gte, ilike, inArray, isNull, moduleEntitlements, municipalitySettings, ne, or,
  rolePermissions, roles, serviceRequestCategories as categories, serviceRequestEvents as events,
  serviceRequests as requests, departments, sql, staffMemberships, users, withTenant, type Tx,
} from "@municipalos/database";
import { alias } from "@municipalos/database";
import { serviceRequestVisibility, toPermissionSet, type RequestVisibility } from "@municipalos/permissions";
import type { ChangeStatusInput, CreateServiceRequestInput, ListServiceRequestsQuery } from "@municipalos/validation";
import {
  OPEN_SERVICE_REQUEST_STATUSES, availableTransitions, checkTransition, serviceRequestWorkflow,
  type ServiceRequestStatus, type ServiceRequestWorkflowPermission,
} from "@municipalos/workflows";
import type { AppDeps, Municipality, StaffContext } from "../context";
import { AppError, conflict, forbidden, notFound, unprocessable } from "../errors";
import { recordAudit } from "../lib/audit";
import { generateReference } from "../lib/reference";
import { deliverQueuedEmails, departmentStaffUserIds, notifyStaffUsers, queueResidentEmail } from "./notify";

export interface RequestMeta {
  ip: string;
  requestId: string;
}

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

function visibilityCondition(v: RequestVisibility) {
  if (v.scope === "all") return undefined;
  if (v.scope === "department") return eq(requests.departmentId, v.departmentId);
  return sql`false`;
}

const staffVisibility = (staff: StaffContext) =>
  serviceRequestVisibility(staff.permissions, staff.membership.departmentId);

const RESIDENT_HEADLINES: Record<ServiceRequestStatus, string> = {
  new: "We received your request",
  reviewed: "Your request has been reviewed",
  assigned: "Your request has been assigned to city staff",
  in_progress: "Work on your request is in progress",
  resolved: "Your request has been resolved",
  closed: "Your request has been closed",
};

function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = (err as { cause?: unknown })?.cause ?? err;
  const pg = e as { code?: string; constraint_name?: string };
  return pg?.code === "23505" && pg.constraint_name === constraint;
}

/* ───────────────────────────── Resident: create ───────────────────────────── */

export interface CreatedRequest {
  reference: string;
  status: ServiceRequestStatus;
  categoryName: string;
  departmentName: string;
  createdAt: string;
  /** False when an Idempotency-Key matched an earlier submission. */
  created: boolean;
}

export async function createServiceRequest(
  deps: AppDeps,
  municipality: Municipality,
  input: CreateServiceRequestInput,
  idempotencyKey: string | null,
  meta: RequestMeta,
): Promise<CreatedRequest> {
  const findExisting = (tx: Tx) =>
    tx
      .select({
        reference: requests.reference,
        status: requests.status,
        createdAt: requests.createdAt,
        categoryName: categories.name,
        departmentName: departments.name,
      })
      .from(requests)
      .innerJoin(categories, eq(categories.id, requests.categoryId))
      .innerJoin(departments, eq(departments.id, requests.departmentId))
      .where(eq(requests.idempotencyKey, idempotencyKey ?? ""));

  const attempt = () =>
    withTenant(deps.db, { municipalityId: municipality.id }, async (tx) => {
      const [entitlement] = await tx
        .select({ enabled: moduleEntitlements.enabled })
        .from(moduleEntitlements)
        .where(eq(moduleEntitlements.moduleKey, "service_requests"));
      if (!entitlement?.enabled) {
        throw new AppError(404, "module_not_enabled", "Online service requests are not available for this municipality.");
      }

      if (idempotencyKey) {
        const [existing] = await findExisting(tx);
        if (existing) return { result: { ...existing, createdAt: iso(existing.createdAt), created: false }, emailIds: [] };
      }

      const [settings] = await tx.select().from(municipalitySettings);
      if (settings && !settings.allowAnonymousRequests && !(input.reporterName && input.reporterEmail)) {
        throw unprocessable("contact_required", "This municipality requires your name and email to submit a request.");
      }

      const [category] = await tx
        .select({ id: categories.id, name: categories.name, departmentId: categories.departmentId, departmentName: departments.name })
        .from(categories)
        .innerJoin(departments, eq(departments.id, categories.departmentId))
        .where(and(eq(categories.id, input.categoryId), eq(categories.isActive, true)));
      if (!category) throw unprocessable("invalid_category", "Choose a request category from the list.");

      const [request] = await tx
        .insert(requests)
        .values({
          municipalityId: municipality.id,
          reference: generateReference(municipality.referencePrefix),
          categoryId: category.id,
          // Routing: the category decides the responsible department.
          departmentId: category.departmentId,
          description: input.description,
          locationText: input.locationText,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          reporterName: input.reporterName ?? null,
          reporterEmail: input.reporterEmail ?? null,
          reporterPhone: input.reporterPhone ?? null,
          idempotencyKey,
        })
        .returning();
      if (!request) throw new Error("service request insert returned no row");

      await tx.insert(events).values({
        municipalityId: municipality.id,
        requestId: request.id,
        type: "created",
        visibility: "public",
        toStatus: "new",
        actorKind: "resident",
      });
      await recordAudit(tx, {
        municipalityId: municipality.id,
        actorKind: input.reporterEmail ? "resident" : "anonymous",
        action: "service_request.created",
        entityType: "service_request",
        entityId: request.id,
        metadata: { reference: request.reference, categoryId: category.id, departmentId: category.departmentId },
        ...meta,
      });
      await notifyStaffUsers(
        tx,
        municipality.id,
        await departmentStaffUserIds(tx, category.departmentId),
        `New ${category.name.toLowerCase()} request ${request.reference}`,
        request.locationText,
        request.id,
      );
      const emailIds = await queueResidentEmail(tx, deps, municipality, request, category.name, RESIDENT_HEADLINES.new);

      return {
        result: {
          reference: request.reference,
          status: request.status,
          categoryName: category.name,
          departmentName: category.departmentName,
          createdAt: iso(request.createdAt),
          created: true,
        },
        emailIds,
      };
    });

  let outcome;
  try {
    outcome = await attempt();
  } catch (err) {
    // Two submissions with the same Idempotency-Key raced; the loser returns the winner's row.
    if (!idempotencyKey || !isUniqueViolation(err, "service_requests_idempotency_idx")) throw err;
    const [existing] = await withTenant(deps.db, { municipalityId: municipality.id }, findExisting);
    if (!existing) throw err;
    return { ...existing, createdAt: iso(existing.createdAt), created: false };
  }
  await deliverQueuedEmails(deps, municipality.id, outcome.emailIds);
  return outcome.result;
}

/* ───────────────────────────── Resident: track ───────────────────────────── */

export async function getPublicRequest(deps: AppDeps, municipality: Municipality, reference: string) {
  return withTenant(deps.db, { municipalityId: municipality.id }, async (tx) => {
    const [request] = await tx
      .select({
        id: requests.id,
        reference: requests.reference,
        status: requests.status,
        description: requests.description,
        locationText: requests.locationText,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
        categoryName: categories.name,
        departmentName: departments.name,
      })
      .from(requests)
      .innerJoin(categories, eq(categories.id, requests.categoryId))
      .innerJoin(departments, eq(departments.id, requests.departmentId))
      .where(eq(requests.reference, reference));
    if (!request) throw notFound("Request");

    const timeline = await tx
      .select({ id: events.id, type: events.type, toStatus: events.toStatus, body: events.body, actorKind: events.actorKind, createdAt: events.createdAt })
      .from(events)
      .where(and(eq(events.requestId, request.id), eq(events.visibility, "public")))
      .orderBy(asc(events.createdAt), asc(events.id));

    // Deliberately excludes reporter contact details, assignee and internal notes.
    return {
      reference: request.reference,
      status: request.status,
      statusLabel: serviceRequestWorkflow.states[request.status].label,
      isOpen: serviceRequestWorkflow.states[request.status].open,
      description: request.description,
      locationText: request.locationText,
      categoryName: request.categoryName,
      departmentName: request.departmentName,
      createdAt: iso(request.createdAt),
      updatedAt: iso(request.updatedAt),
      timeline: timeline.map((e) => ({
        id: e.id,
        type: e.type,
        toStatus: e.toStatus,
        body: e.body,
        from: e.actorKind === "resident" ? ("resident" as const) : ("city" as const),
        createdAt: iso(e.createdAt),
      })),
    };
  });
}

export async function addResidentMessage(
  deps: AppDeps,
  municipality: Municipality,
  reference: string,
  body: string,
  meta: RequestMeta,
): Promise<void> {
  await withTenant(deps.db, { municipalityId: municipality.id }, async (tx) => {
    const [request] = await tx.select().from(requests).where(eq(requests.reference, reference));
    if (!request) throw notFound("Request");
    if (request.status === "closed") throw conflict("request_closed", "This request is closed. Please submit a new request.");
    await tx.insert(events).values({
      municipalityId: municipality.id,
      requestId: request.id,
      type: "resident_message",
      visibility: "public",
      body,
      actorKind: "resident",
    });
    await tx.update(requests).set({ updatedAt: new Date() }).where(eq(requests.id, request.id));
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "resident",
      action: "service_request.resident_message_added",
      entityType: "service_request",
      entityId: request.id,
      ...meta,
    });
    const recipients = request.assignedToUserId
      ? [request.assignedToUserId]
      : await departmentStaffUserIds(tx, request.departmentId);
    await notifyStaffUsers(tx, municipality.id, recipients, `Resident replied on ${request.reference}`, body.slice(0, 140), request.id);
  });
}

/* ───────────────────────────── Staff: read ───────────────────────────── */

const assignee = alias(users, "assignee");

const listColumns = {
  id: requests.id,
  reference: requests.reference,
  status: requests.status,
  description: requests.description,
  locationText: requests.locationText,
  createdAt: requests.createdAt,
  updatedAt: requests.updatedAt,
  categoryName: categories.name,
  departmentId: requests.departmentId,
  departmentName: departments.name,
  assignedToUserId: requests.assignedToUserId,
  assigneeName: assignee.name,
};

interface ListRow {
  id: string;
  reference: string;
  status: ServiceRequestStatus;
  description: string;
  locationText: string;
  createdAt: Date;
  updatedAt: Date;
  categoryName: string;
  departmentId: string;
  departmentName: string;
  assignedToUserId: string | null;
  assigneeName: string | null;
}

const toListItem = (r: ListRow) => ({
  id: r.id,
  reference: r.reference,
  status: r.status,
  statusLabel: serviceRequestWorkflow.states[r.status].label,
  description: r.description,
  locationText: r.locationText,
  categoryName: r.categoryName,
  departmentId: r.departmentId,
  departmentName: r.departmentName,
  assignee: r.assignedToUserId && r.assigneeName ? { id: r.assignedToUserId, name: r.assigneeName } : null,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

function listQuery(tx: Tx) {
  return tx
    .select(listColumns)
    .from(requests)
    .innerJoin(categories, eq(categories.id, requests.categoryId))
    .innerJoin(departments, eq(departments.id, requests.departmentId))
    .leftJoin(assignee, eq(assignee.id, requests.assignedToUserId));
}

export async function listRequests(deps: AppDeps, staff: StaffContext, userId: string, query: ListServiceRequestsQuery) {
  const visibility = staffVisibility(staff);
  if (visibility.scope === "none") throw forbidden("Your role does not include access to service requests.");

  const conditions = [
    visibilityCondition(visibility),
    query.status === "all"
      ? undefined
      : query.status === "open"
        ? inArray(requests.status, OPEN_SERVICE_REQUEST_STATUSES)
        : eq(requests.status, query.status),
    query.departmentId ? eq(requests.departmentId, query.departmentId) : undefined,
    query.assignee === "me"
      ? eq(requests.assignedToUserId, userId)
      : query.assignee === "unassigned"
        ? isNull(requests.assignedToUserId)
        : undefined,
    query.q
      ? or(
          ilike(requests.reference, `%${escapeLike(query.q)}%`),
          ilike(requests.description, `%${escapeLike(query.q)}%`),
          ilike(requests.locationText, `%${escapeLike(query.q)}%`),
        )
      : undefined,
  ];
  const where = and(...conditions);
  const order =
    query.sort === "oldest" ? asc(requests.createdAt) : query.sort === "updated" ? desc(requests.updatedAt) : desc(requests.createdAt);

  return withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const [total] = await tx.select({ value: count() }).from(requests).where(where);
    const rows = await listQuery(tx)
      .where(where)
      .orderBy(order, desc(requests.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return {
      items: rows.map(toListItem),
      pagination: { page: query.page, pageSize: query.pageSize, total: total?.value ?? 0 },
    };
  });
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Loads a request the staff member is allowed to see, or throws 404 (never 403, to avoid confirming existence). */
async function loadVisibleRequest(tx: Tx, staff: StaffContext, id: string) {
  const [request] = await tx
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), visibilityCondition(staffVisibility(staff))));
  if (!request) throw notFound("Request");
  return request;
}

export async function getRequestDetail(deps: AppDeps, staff: StaffContext, userId: string, id: string) {
  return withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const request = await loadVisibleRequest(tx, staff, id);
    const [row] = await listQuery(tx).where(eq(requests.id, request.id));
    if (!row) throw notFound("Request");

    const actor = alias(users, "actor");
    const subject = alias(users, "subject");
    const history = await tx
      .select({
        id: events.id, type: events.type, visibility: events.visibility, fromStatus: events.fromStatus,
        toStatus: events.toStatus, body: events.body, actorKind: events.actorKind, actorName: actor.name,
        subjectName: subject.name, createdAt: events.createdAt,
      })
      .from(events)
      .leftJoin(actor, eq(actor.id, events.actorUserId))
      .leftJoin(subject, eq(subject.id, events.subjectUserId))
      .where(eq(events.requestId, request.id))
      .orderBy(asc(events.createdAt), asc(events.id));

    // Possible duplicates: other open requests in the same category within ~150 m, or at the
    // same typed location. A hint for staff review only; nothing is merged automatically.
    const near =
      request.latitude !== null && request.longitude !== null
        ? sql`(${requests.latitude} between ${request.latitude - 0.00135} and ${request.latitude + 0.00135}
              and ${requests.longitude} between ${request.longitude - 0.0018} and ${request.longitude + 0.0018})`
        : sql`false`;
    const duplicates = await tx
      .select({ id: requests.id, reference: requests.reference, status: requests.status, locationText: requests.locationText, createdAt: requests.createdAt })
      .from(requests)
      .where(
        and(
          ne(requests.id, request.id),
          eq(requests.categoryId, request.categoryId),
          inArray(requests.status, OPEN_SERVICE_REQUEST_STATUSES),
          or(near, sql`lower(${requests.locationText}) = lower(${request.locationText})`),
          visibilityCondition(staffVisibility(staff)),
        ),
      )
      .orderBy(desc(requests.createdAt))
      .limit(5);

    const transitions = availableTransitions(
      serviceRequestWorkflow,
      request.status,
      staff.permissions as ReadonlySet<ServiceRequestWorkflowPermission>,
    );

    return {
      ...toListItem(row),
      latitude: request.latitude,
      longitude: request.longitude,
      reporter: { name: request.reporterName, email: request.reporterEmail, phone: request.reporterPhone },
      resolvedAt: isoOrNull(request.resolvedAt),
      closedAt: isoOrNull(request.closedAt),
      events: history.map((e) => ({
        id: e.id,
        type: e.type,
        visibility: e.visibility,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        body: e.body,
        actorKind: e.actorKind,
        actorName: e.actorName,
        subjectName: e.subjectName,
        createdAt: iso(e.createdAt),
      })),
      availableTransitions: transitions
        .filter((t) => !t.requiresAssignee)
        .map((t) => ({ to: t.to, label: t.label, requiresNote: Boolean(t.requiresNote) })),
      possibleDuplicates: duplicates.map((d) => ({
        id: d.id, reference: d.reference, status: d.status, locationText: d.locationText, createdAt: iso(d.createdAt),
      })),
    };
  });
}

/* ───────────────────────────── Staff: mutate ───────────────────────────── */

async function categoryName(tx: Tx, categoryId: string): Promise<string> {
  const [c] = await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId));
  return c?.name ?? "Service request";
}

/** Applies a status change guarded by the stored status, so concurrent updates cannot both win. */
async function applyStatus(tx: Tx, requestId: string, from: ServiceRequestStatus, to: ServiceRequestStatus, extra: Partial<typeof requests.$inferInsert> = {}) {
  const now = new Date();
  const updated = await tx
    .update(requests)
    .set({
      status: to,
      updatedAt: now,
      resolvedAt: to === "resolved" ? now : to === "in_progress" ? null : undefined,
      closedAt: to === "closed" ? now : to === "in_progress" ? null : undefined,
      ...extra,
    })
    .where(and(eq(requests.id, requestId), eq(requests.status, from)))
    .returning({ id: requests.id });
  if (updated.length === 0) {
    throw conflict("stale_status", "This request was just updated by someone else. Reload and try again.");
  }
}

export async function changeStatus(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  input: ChangeStatusInput,
  meta: RequestMeta,
): Promise<void> {
  const { municipality } = staff;
  const emailIds = await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const request = await loadVisibleRequest(tx, staff, id);
    const check = checkTransition(serviceRequestWorkflow, {
      from: request.status,
      to: input.to,
      permissions: staff.permissions as ReadonlySet<ServiceRequestWorkflowPermission>,
      note: input.note,
    });
    if (!check.ok) {
      if (check.reason === "forbidden") throw forbidden();
      if (check.reason === "note_required") throw unprocessable("note_required", "Add a note explaining this change.");
      throw unprocessable(
        "invalid_transition",
        `A request that is "${serviceRequestWorkflow.states[request.status].label}" cannot be moved to "${serviceRequestWorkflow.states[input.to].label}".`,
      );
    }
    if (check.transition.requiresAssignee) {
      throw unprocessable("assignee_required", "Assign the request to a staff member to move it to Assigned.");
    }

    await applyStatus(tx, request.id, request.status, input.to);
    await tx.insert(events).values({
      municipalityId: municipality.id,
      requestId: request.id,
      type: "status_changed",
      visibility: "public",
      fromStatus: request.status,
      toStatus: input.to,
      body: input.note ?? null,
      actorKind: "staff",
      actorUserId: userId,
    });
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: "service_request.status_changed",
      entityType: "service_request",
      entityId: request.id,
      metadata: { reference: request.reference, from: request.status, to: input.to },
      ...meta,
    });
    const reopened = !serviceRequestWorkflow.states[request.status].open && input.to === "in_progress";
    return queueResidentEmail(
      tx, deps, municipality, request, await categoryName(tx, request.categoryId),
      reopened ? "Your request has been reopened" : RESIDENT_HEADLINES[input.to],
      input.note,
    );
  });
  await deliverQueuedEmails(deps, municipality.id, emailIds);
}

/** Active staff of this municipality whose role lets them see the given department's requests. */
async function staffWhoCanAccess(tx: Tx, departmentId: string) {
  const members = await tx
    .select({
      userId: staffMemberships.userId, name: users.name, title: staffMemberships.title,
      departmentId: staffMemberships.departmentId, roleId: staffMemberships.roleId, roleName: roles.name,
    })
    .from(staffMemberships)
    .innerJoin(users, eq(users.id, staffMemberships.userId))
    .innerJoin(roles, eq(roles.id, staffMemberships.roleId))
    .where(and(eq(staffMemberships.status, "active"), eq(users.status, "active")))
    .orderBy(asc(users.name));
  const perms = await tx.select().from(rolePermissions);
  return members.filter((m) => {
    const granted = toPermissionSet(perms.filter((p) => p.roleId === m.roleId).map((p) => p.permission));
    if (!granted.has("service_requests.update_status")) return false;
    const v = serviceRequestVisibility(granted, m.departmentId);
    return v.scope === "all" || (v.scope === "department" && v.departmentId === departmentId);
  });
}

export async function listAssignableStaff(deps: AppDeps, staff: StaffContext, userId: string, id: string) {
  return withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const request = await loadVisibleRequest(tx, staff, id);
    const members = await staffWhoCanAccess(tx, request.departmentId);
    return members.map((m) => ({ id: m.userId, name: m.name, title: m.title, roleName: m.roleName }));
  });
}

export async function assignRequest(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  assigneeUserId: string,
  meta: RequestMeta,
): Promise<void> {
  const { municipality } = staff;
  const emailIds = await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const request = await loadVisibleRequest(tx, staff, id);
    if (!serviceRequestWorkflow.states[request.status].open) {
      throw conflict("request_not_open", "Reopen this request before assigning it.");
    }
    // The assignee must be staff of THIS municipality who can work this department's requests.
    const eligible = await staffWhoCanAccess(tx, request.departmentId);
    const target = eligible.find((m) => m.userId === assigneeUserId);
    if (!target) throw unprocessable("invalid_assignee", "That person cannot be assigned to this request.");
    if (request.assignedToUserId === assigneeUserId) return [];

    const becomesAssigned = request.status === "new" || request.status === "reviewed";
    if (becomesAssigned) {
      await applyStatus(tx, request.id, request.status, "assigned", { assignedToUserId: assigneeUserId });
    } else {
      await tx.update(requests).set({ assignedToUserId: assigneeUserId, updatedAt: new Date() }).where(eq(requests.id, request.id));
    }
    const base = { municipalityId: municipality.id, requestId: request.id, actorKind: "staff" as const, actorUserId: userId };
    await tx.insert(events).values({ ...base, type: "assigned", visibility: "internal", subjectUserId: assigneeUserId });
    if (becomesAssigned) {
      await tx.insert(events).values({ ...base, type: "status_changed", visibility: "public", fromStatus: request.status, toStatus: "assigned" });
    }
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: "service_request.assigned",
      entityType: "service_request",
      entityId: request.id,
      metadata: { reference: request.reference, assigneeUserId, previousAssigneeUserId: request.assignedToUserId },
      ...meta,
    });
    if (assigneeUserId !== userId) {
      await notifyStaffUsers(tx, municipality.id, [assigneeUserId], `${request.reference} was assigned to you`, request.locationText, request.id);
    }
    return becomesAssigned
      ? queueResidentEmail(tx, deps, municipality, request, await categoryName(tx, request.categoryId), RESIDENT_HEADLINES.assigned)
      : [];
  });
  await deliverQueuedEmails(deps, municipality.id, emailIds);
}

export async function addStaffComment(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  input: { body: string; visibility: "internal" | "public" },
  meta: RequestMeta,
): Promise<void> {
  const { municipality } = staff;
  const emailIds = await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const request = await loadVisibleRequest(tx, staff, id);
    await tx.insert(events).values({
      municipalityId: municipality.id,
      requestId: request.id,
      type: input.visibility === "public" ? "staff_message" : "staff_note",
      visibility: input.visibility,
      body: input.body,
      actorKind: "staff",
      actorUserId: userId,
    });
    await tx.update(requests).set({ updatedAt: new Date() }).where(eq(requests.id, request.id));
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: input.visibility === "public" ? "service_request.message_sent" : "service_request.note_added",
      entityType: "service_request",
      entityId: request.id,
      metadata: { reference: request.reference },
      ...meta,
    });
    return input.visibility === "public"
      ? queueResidentEmail(tx, deps, municipality, request, await categoryName(tx, request.categoryId), "City staff sent you a message about your request", input.body)
      : [];
  });
  await deliverQueuedEmails(deps, municipality.id, emailIds);
}

/* ───────────────────────────── Staff: dashboard ───────────────────────────── */

export async function getDashboard(deps: AppDeps, staff: StaffContext, userId: string) {
  const visibility = staffVisibility(staff);
  if (visibility.scope === "none") {
    return { hasRequestAccess: false as const, statusCounts: [], myQueue: [], needsTriage: [], metrics: null };
  }
  const visible = visibilityCondition(visibility);
  return withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const counts = await tx
      .select({ status: requests.status, value: count() })
      .from(requests)
      .where(visible)
      .groupBy(requests.status);
    const myQueue = await listQuery(tx)
      .where(and(visible, eq(requests.assignedToUserId, userId), inArray(requests.status, OPEN_SERVICE_REQUEST_STATUSES)))
      .orderBy(asc(requests.createdAt))
      .limit(10);
    const needsTriage = await listQuery(tx)
      .where(and(visible, inArray(requests.status, ["new", "reviewed"])))
      .orderBy(asc(requests.createdAt))
      .limit(10);

    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const [resolved] = await tx
      .select({
        value: count(),
        avgHours: sql<number | null>`avg(extract(epoch from (${requests.resolvedAt} - ${requests.createdAt})) / 3600)::float8`,
      })
      .from(requests)
      .where(and(visible, gte(requests.resolvedAt, since30)));
    const [received] = await tx.select({ value: count() }).from(requests).where(and(visible, gte(requests.createdAt, since7)));

    const byStatus = new Map(counts.map((c) => [c.status, c.value]));
    return {
      hasRequestAccess: true as const,
      statusCounts: (Object.keys(serviceRequestWorkflow.states) as ServiceRequestStatus[]).map((status) => ({
        status,
        label: serviceRequestWorkflow.states[status].label,
        count: byStatus.get(status) ?? 0,
      })),
      myQueue: myQueue.map(toListItem),
      needsTriage: needsTriage.map(toListItem),
      metrics: {
        open: OPEN_SERVICE_REQUEST_STATUSES.reduce((n, st) => n + (byStatus.get(st) ?? 0), 0),
        receivedLast7Days: received?.value ?? 0,
        resolvedLast30Days: resolved?.value ?? 0,
        avgHoursToResolveLast30Days: resolved?.avgHours == null ? null : Math.round(resolved.avgHours * 10) / 10,
      },
    };
  });
}
