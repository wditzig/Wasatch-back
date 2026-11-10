/**
 * MunicipalOS database schema.
 *
 * Conventions
 *  - Every table has a uuid primary key and timestamptz timestamps.
 *  - Tenant-owned tables carry `municipality_id` and are protected by row-level security
 *    (see drizzle/0001_row_level_security.sql). Policies key off the `app.tenant_id` setting
 *    which is set per transaction by `withTenant()`.
 *  - Tenant-owned parents expose UNIQUE (municipality_id, id) so children can use composite
 *    foreign keys. That makes "a request pointing at another city's category" impossible at
 *    the database level, independent of application code.
 *
 * Data classification is documented per table in docs/DATABASE_SCHEMA.md.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ServiceRequestStatus } from "@municipalos/workflows";

const citext = customType<{ data: string }>({ dataType: () => "citext" });

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const tenantId = () =>
  uuid("municipality_id")
    .notNull()
    .references(() => municipalities.id, { onDelete: "restrict" });

/* ───────────────────────────── Platform-level ───────────────────────────── */

export const municipalities = pgTable(
  "municipalities",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    state: text("state").notNull(),
    timezone: text("timezone").notNull().default("America/Denver"),
    /** Prefix for resident-facing tracking numbers, e.g. "CR". */
    referencePrefix: text("reference_prefix").notNull(),
    status: text("status")
      .$type<"onboarding" | "active" | "suspended">()
      .notNull()
      .default("onboarding"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("municipalities_status_check", sql`${t.status} in ('onboarding','active','suspended')`),
    check("municipalities_prefix_check", sql`${t.referencePrefix} ~ '^[A-Z]{2,4}$'`),
  ],
);

export const municipalityDomains = pgTable("municipality_domains", {
  id: id(),
  municipalityId: tenantId(),
  hostname: citext("hostname").notNull().unique(),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: createdAt(),
});

export interface Branding {
  primaryColor: string;
  tagline?: string;
}
export interface ContactInfo {
  address: string;
  phone: string;
  email: string;
  hours: string;
}

export const municipalitySettings = pgTable("municipality_settings", {
  municipalityId: uuid("municipality_id")
    .primaryKey()
    .references(() => municipalities.id, { onDelete: "restrict" }),
  branding: jsonb("branding").$type<Branding>().notNull(),
  contact: jsonb("contact").$type<ContactInfo>().notNull(),
  /** Municipal policy: may residents report issues without identifying themselves? */
  allowAnonymousRequests: boolean("allow_anonymous_requests").notNull().default(true),
  updatedAt: updatedAt(),
});

export const moduleEntitlements = pgTable(
  "module_entitlements",
  {
    municipalityId: tenantId(),
    moduleKey: text("module_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.municipalityId, t.moduleKey] })],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: citext("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    /** MunicipalOS personnel. Grants NO access to municipal records by itself. */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    status: text("status").$type<"active" | "disabled">().notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("users_status_check", sql`${t.status} in ('active','disabled')`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the bearer token. The token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ───────────────────────────── Tenant-owned ───────────────────────────── */

export const departments = pgTable(
  "departments",
  {
    id: id(),
    municipalityId: tenantId(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    phone: text("phone"),
    email: text("email"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("departments_tenant_slug").on(t.municipalityId, t.slug),
    unique("departments_tenant_id").on(t.municipalityId, t.id),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: id(),
    municipalityId: tenantId(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique("roles_tenant_key").on(t.municipalityId, t.key),
    unique("roles_tenant_id").on(t.municipalityId, t.id),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    municipalityId: tenantId(),
    roleId: uuid("role_id").notNull(),
    permission: text("permission").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permission] }),
    foreignKey({
      name: "role_permissions_role_fk",
      columns: [t.municipalityId, t.roleId],
      foreignColumns: [roles.municipalityId, roles.id],
    }).onDelete("cascade"),
  ],
);

export const staffMemberships = pgTable(
  "staff_memberships",
  {
    id: id(),
    municipalityId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    roleId: uuid("role_id").notNull(),
    departmentId: uuid("department_id"),
    title: text("title"),
    status: text("status").$type<"active" | "suspended">().notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("staff_memberships_tenant_user").on(t.municipalityId, t.userId),
    index("staff_memberships_user_idx").on(t.userId),
    foreignKey({
      name: "staff_memberships_role_fk",
      columns: [t.municipalityId, t.roleId],
      foreignColumns: [roles.municipalityId, roles.id],
    }),
    foreignKey({
      name: "staff_memberships_department_fk",
      columns: [t.municipalityId, t.departmentId],
      foreignColumns: [departments.municipalityId, departments.id],
    }),
    check("staff_memberships_status_check", sql`${t.status} in ('active','suspended')`),
  ],
);

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    municipalityId: tenantId(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_tenant_published_idx").on(t.municipalityId, t.publishedAt)],
);

export const serviceRequestCategories = pgTable(
  "service_request_categories",
  {
    id: id(),
    municipalityId: tenantId(),
    /** Requests in this category are routed to this department. */
    departmentId: uuid("department_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Lowercase keywords used by the rules-based category suggester. */
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("service_request_categories_tenant_slug").on(t.municipalityId, t.slug),
    unique("service_request_categories_tenant_id").on(t.municipalityId, t.id),
    foreignKey({
      name: "service_request_categories_department_fk",
      columns: [t.municipalityId, t.departmentId],
      foreignColumns: [departments.municipalityId, departments.id],
    }),
  ],
);

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: id(),
    municipalityId: tenantId(),
    /** Resident-facing tracking number. Random, not sequential. */
    reference: text("reference").notNull().unique(),
    categoryId: uuid("category_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    status: text("status").$type<ServiceRequestStatus>().notNull().default("new"),
    description: text("description").notNull(),
    locationText: text("location_text").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    /** Reporter contact details: sensitive, never returned by public endpoints. */
    reporterName: text("reporter_name"),
    reporterEmail: text("reporter_email"),
    reporterPhone: text("reporter_phone"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    /** Client-supplied key making resident submission safe to retry. */
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    unique("service_requests_tenant_id").on(t.municipalityId, t.id),
    uniqueIndex("service_requests_idempotency_idx")
      .on(t.municipalityId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index("service_requests_queue_idx").on(t.municipalityId, t.status, t.createdAt),
    index("service_requests_department_idx").on(t.municipalityId, t.departmentId, t.status),
    index("service_requests_assignee_idx").on(t.municipalityId, t.assignedToUserId),
    foreignKey({
      name: "service_requests_category_fk",
      columns: [t.municipalityId, t.categoryId],
      foreignColumns: [serviceRequestCategories.municipalityId, serviceRequestCategories.id],
    }),
    foreignKey({
      name: "service_requests_department_fk",
      columns: [t.municipalityId, t.departmentId],
      foreignColumns: [departments.municipalityId, departments.id],
    }),
    check(
      "service_requests_status_check",
      sql`${t.status} in ('new','reviewed','assigned','in_progress','resolved','closed')`,
    ),
    check(
      "service_requests_coordinates_check",
      sql`(${t.latitude} is null) = (${t.longitude} is null)`,
    ),
  ],
);

export type ServiceRequestEventType =
  | "created"
  | "status_changed"
  | "assigned"
  | "unassigned"
  | "staff_note"
  | "staff_message"
  | "resident_message";

/** Append-only history. The runtime role has no UPDATE/DELETE privilege on this table. */
export const serviceRequestEvents = pgTable(
  "service_request_events",
  {
    id: id(),
    /** Monotonic insertion order. Events in one transaction share a timestamp, so order by this. */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity().notNull(),
    municipalityId: tenantId(),
    requestId: uuid("request_id").notNull(),
    type: text("type").$type<ServiceRequestEventType>().notNull(),
    /** `public` events are visible to the resident on the tracking page. */
    visibility: text("visibility").$type<"public" | "internal">().notNull(),
    fromStatus: text("from_status").$type<ServiceRequestStatus>(),
    toStatus: text("to_status").$type<ServiceRequestStatus>(),
    body: text("body"),
    actorKind: text("actor_kind").$type<"resident" | "staff" | "system">().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    /** For assignment events. */
    subjectUserId: uuid("subject_user_id").references(() => users.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("service_request_events_request_idx").on(t.requestId, t.seq),
    foreignKey({
      name: "service_request_events_request_fk",
      columns: [t.municipalityId, t.requestId],
      foreignColumns: [serviceRequests.municipalityId, serviceRequests.id],
    }),
    check("service_request_events_visibility_check", sql`${t.visibility} in ('public','internal')`),
    check(
      "service_request_events_actor_check",
      sql`${t.actorKind} in ('resident','staff','system')`,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    municipalityId: tenantId(),
    channel: text("channel").$type<"in_app" | "email">().notNull(),
    /** in_app notifications target a staff user; email notifications target an address. */
    recipientUserId: uuid("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email"),
    subject: text("subject").notNull(),
    body: text("body").notNull().default(""),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    status: text("status").$type<"queued" | "sent" | "failed">().notNull().default("queued"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.municipalityId, t.recipientUserId, t.createdAt),
    check("notifications_channel_check", sql`${t.channel} in ('in_app','email')`),
    check(
      "notifications_recipient_check",
      sql`(${t.channel} = 'in_app' and ${t.recipientUserId} is not null) or (${t.channel} = 'email' and ${t.recipientEmail} is not null)`,
    ),
  ],
);

/**
 * Append-only audit trail. `municipality_id` is null for platform-level events (e.g. a failed
 * login for an unknown account). The runtime role has no UPDATE/DELETE privilege.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    municipalityId: uuid("municipality_id").references(() => municipalities.id, {
      onDelete: "restrict",
    }),
    actorKind: text("actor_kind").$type<"resident" | "staff" | "system" | "anonymous">().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_events_tenant_created_idx").on(t.municipalityId, t.createdAt)],
);
