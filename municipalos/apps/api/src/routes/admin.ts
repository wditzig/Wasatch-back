/**
 * Municipal administration: service categories, city settings and staff access.
 * Registered on the staff router, so every route is already behind a verified session and an
 * active membership in the municipality named in the URL.
 */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import {
  and,
  asc,
  departments,
  eq,
  municipalitySettings,
  notifications,
  rolePermissions,
  roles,
  serviceRequestCategories as categories,
  staffMemberships,
  users,
  withTenant,
} from "@municipalos/database";
import { PERMISSION_DESCRIPTIONS, isPermission } from "@municipalos/permissions";
import type { Context } from "hono";
import type { AppDeps, AppEnv } from "../context";
import { conflict, forbidden, notFound, unprocessable } from "../errors";
import { recordAudit } from "../lib/audit";
import { assertCan } from "../middleware/auth";
import { body, errorResponses, idParam, json, okSchema, slugParam } from "../schemas";

const tags = ["Administration"];
const security = [{ bearerAuth: [] }];
const ok = { ok: true as const };

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const keywordsSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(40)
      .regex(
        /^[a-z0-9][a-z0-9 '-]*$/,
        "Keywords may contain letters, numbers, spaces, hyphens and apostrophes",
      ),
  )
  .max(25)
  .transform((list) => [...new Set(list)]);

export const categoryInputSchema = z.object({
  name: text(2, 80),
  description: z.string().trim().max(300).default(""),
  departmentId: z.uuid(),
  keywords: keywordsSchema.default([]),
});
// Written out rather than derived with .partial(): the create schema's defaults would otherwise
// silently reset description and keywords on every partial update.
export const categoryPatchSchema = z.object({
  name: text(2, 80).optional(),
  description: z.string().trim().max(300).optional(),
  departmentId: z.uuid().optional(),
  keywords: keywordsSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const categorySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    departmentId: z.string(),
    departmentName: z.string(),
    keywords: z.array(z.string()),
    isActive: z.boolean(),
    sortOrder: z.number(),
  })
  .openapi("AdminCategory");

export const settingsSchema = z
  .object({
    branding: z.object({
      primaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour such as #1f5f8b"),
      tagline: z.string().trim().max(120).optional(),
    }),
    contact: z.object({
      address: text(3, 200),
      phone: text(7, 30).regex(/^[0-9+() .-]+$/, "Enter a phone number"),
      email: z.email().max(254),
      hours: text(3, 120),
    }),
    allowAnonymousRequests: z.boolean(),
  })
  .openapi("MunicipalSettings");

export const membershipPatchSchema = z.object({
  roleId: z.uuid().optional(),
  departmentId: z.uuid().nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

const staffMemberSchema = z
  .object({
    membershipId: z.string(),
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    title: z.string().nullable(),
    roleId: z.string(),
    roleKey: z.string(),
    roleName: z.string(),
    departmentId: z.string().nullable(),
    departmentName: z.string().nullable(),
    status: z.enum(["active", "suspended"]),
    isSelf: z.boolean(),
  })
  .openapi("StaffMember");

const roleSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    name: z.string(),
    description: z.string(),
    isSystem: z.boolean(),
    permissions: z.array(z.object({ key: z.string(), description: z.string() })),
  })
  .openapi("Role");

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function registerStaffAdminRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps) {
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

  /* ───────────── Categories ───────────── */

  const categoryColumns = {
    id: categories.id,
    slug: categories.slug,
    name: categories.name,
    description: categories.description,
    departmentId: categories.departmentId,
    departmentName: departments.name,
    keywords: categories.keywords,
    isActive: categories.isActive,
    sortOrder: categories.sortOrder,
  };

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/admin/categories",
      tags,
      security,
      summary: "All service request categories, including inactive ones",
      request: { params: slugParam },
      responses: {
        200: json(z.object({ items: z.array(categorySchema) }), "Categories"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "categories.manage");
      const items = await withTenant(deps.db, tenant(c), (tx) =>
        tx
          .select(categoryColumns)
          .from(categories)
          .innerJoin(departments, eq(departments.id, categories.departmentId))
          .orderBy(asc(categories.sortOrder), asc(categories.name)),
      );
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/admin/categories",
      tags,
      security,
      summary: "Create a category and choose the department it routes to",
      request: { params: slugParam, body: body(categoryInputSchema) },
      responses: { 201: json(z.object({ id: z.string() }), "Created"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "categories.manage");
      const input = c.req.valid("json");
      const slug = slugify(input.name);
      if (!slug)
        throw unprocessable("invalid_name", "Enter a name that contains letters or numbers.");
      const id = await withTenant(deps.db, tenant(c), async (tx) => {
        const [department] = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.id, input.departmentId));
        if (!department)
          throw unprocessable("invalid_department", "Choose a department from the list.");
        const [existing] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slug, slug));
        if (existing)
          throw conflict("category_exists", "A category with this name already exists.");
        const [last] = await tx
          .select({ sortOrder: categories.sortOrder })
          .from(categories)
          .orderBy(asc(categories.sortOrder));
        const [row] = await tx
          .insert(categories)
          .values({
            municipalityId: c.get("staff").municipality.id,
            slug,
            name: input.name,
            description: input.description,
            departmentId: input.departmentId,
            keywords: input.keywords,
            sortOrder: (last?.sortOrder ?? 0) + 100,
          })
          .returning({ id: categories.id });
        await recordAudit(tx, {
          ...auditBase(c),
          action: "category.created",
          entityType: "service_request_category",
          entityId: row!.id,
          metadata: { name: input.name, departmentId: input.departmentId },
        });
        return row!.id;
      });
      return c.json({ id }, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/{slug}/admin/categories/{id}",
      tags,
      security,
      summary: "Edit, re-route, activate or deactivate a category",
      description:
        "Changing the department affects new requests only. Deactivating hides the category from residents; existing requests keep it.",
      request: { params: idParam, body: body(categoryPatchSchema) },
      responses: { 200: json(okSchema, "Updated"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "categories.manage");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      await withTenant(deps.db, tenant(c), async (tx) => {
        const [current] = await tx.select().from(categories).where(eq(categories.id, id));
        if (!current) throw notFound("Category");
        if (input.departmentId) {
          const [department] = await tx
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.id, input.departmentId));
          if (!department)
            throw unprocessable("invalid_department", "Choose a department from the list.");
        }
        if (input.isActive === false && current.isActive) {
          const active = await tx
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.isActive, true));
          if (active.length <= 1)
            throw conflict(
              "last_category",
              "At least one category must stay active so residents can report problems.",
            );
        }
        const changes = Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(changes).length === 0) return;
        await tx
          .update(categories)
          .set({ ...changes, updatedAt: new Date() })
          .where(eq(categories.id, id));
        await recordAudit(tx, {
          ...auditBase(c),
          action: "category.updated",
          entityType: "service_request_category",
          entityId: id,
          metadata: { changed: Object.keys(changes), name: input.name ?? current.name },
        });
      });
      return c.json(ok, 200);
    },
  );

  /* ───────────── Settings ───────────── */

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/admin/settings",
      tags,
      security,
      summary: "Branding, contact details and reporting policy",
      request: { params: slugParam },
      responses: { 200: json(settingsSchema, "Settings"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "settings.manage");
      const [row] = await withTenant(deps.db, tenant(c), (tx) =>
        tx.select().from(municipalitySettings),
      );
      if (!row) throw notFound("Settings");
      return c.json(
        {
          branding: row.branding,
          contact: row.contact,
          allowAnonymousRequests: row.allowAnonymousRequests,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/{slug}/admin/settings",
      tags,
      security,
      summary: "Replace the municipality's settings",
      request: { params: slugParam, body: body(settingsSchema) },
      responses: { 200: json(okSchema, "Saved"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "settings.manage");
      const input = c.req.valid("json");
      await withTenant(deps.db, tenant(c), async (tx) => {
        const [before] = await tx.select().from(municipalitySettings);
        if (!before) throw notFound("Settings");
        const branding = {
          primaryColor: input.branding.primaryColor.toLowerCase(),
          ...(input.branding.tagline ? { tagline: input.branding.tagline } : {}),
        };
        // RLS limits this to the caller's municipality; the explicit filter is belt and braces.
        await tx
          .update(municipalitySettings)
          .set({
            branding,
            contact: input.contact,
            allowAnonymousRequests: input.allowAnonymousRequests,
            updatedAt: new Date(),
          })
          .where(eq(municipalitySettings.municipalityId, c.get("staff").municipality.id));
        const changed = [
          JSON.stringify(before.branding) !== JSON.stringify(branding) ? "branding" : null,
          JSON.stringify(before.contact) !== JSON.stringify(input.contact) ? "contact" : null,
          before.allowAnonymousRequests !== input.allowAnonymousRequests
            ? "allowAnonymousRequests"
            : null,
        ].filter(Boolean);
        await recordAudit(tx, {
          ...auditBase(c),
          action: "settings.updated",
          entityType: "municipality_settings",
          metadata: { changed },
        });
      });
      return c.json(ok, 200);
    },
  );

  /* ───────────── Staff access ───────────── */

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/admin/staff",
      tags,
      security,
      summary: "Staff of the municipality with their role, department and status",
      request: { params: slugParam },
      responses: {
        200: json(z.object({ items: z.array(staffMemberSchema) }), "Staff"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "staff.read");
      const self = c.get("auth").user.id;
      const rows = await withTenant(deps.db, tenant(c), (tx) =>
        tx
          .select({
            membershipId: staffMemberships.id,
            userId: users.id,
            name: users.name,
            email: users.email,
            title: staffMemberships.title,
            roleId: roles.id,
            roleKey: roles.key,
            roleName: roles.name,
            departmentId: staffMemberships.departmentId,
            departmentName: departments.name,
            status: staffMemberships.status,
          })
          .from(staffMemberships)
          .innerJoin(users, eq(users.id, staffMemberships.userId))
          .innerJoin(roles, eq(roles.id, staffMemberships.roleId))
          .leftJoin(departments, eq(departments.id, staffMemberships.departmentId))
          .orderBy(asc(users.name)),
      );
      return c.json({ items: rows.map((r) => ({ ...r, isSelf: r.userId === self })) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/admin/roles",
      tags,
      security,
      summary: "Roles and the permissions each grants (for access reviews)",
      request: { params: slugParam },
      responses: {
        200: json(z.object({ items: z.array(roleSchema) }), "Roles"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "staff.read");
      const result = await withTenant(deps.db, tenant(c), async (tx) => ({
        roles: await tx.select().from(roles).orderBy(asc(roles.name)),
        permissions: await tx.select().from(rolePermissions),
      }));
      const items = result.roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: result.permissions
          .filter((p) => p.roleId === r.id && isPermission(p.permission))
          .map((p) => ({
            key: p.permission,
            description:
              PERMISSION_DESCRIPTIONS[p.permission as keyof typeof PERMISSION_DESCRIPTIONS],
          }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      }));
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/{slug}/admin/staff/{id}",
      tags,
      security,
      summary: "Change a staff member's role, department, title or access status",
      description:
        "Nobody can change their own access. Suspending takes effect on the member's next request.",
      request: { params: idParam, body: body(membershipPatchSchema) },
      responses: { 200: json(okSchema, "Updated"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "staff.manage");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const actor = c.get("auth").user.id;
      const municipalityId = c.get("staff").municipality.id;
      await withTenant(deps.db, tenant(c), async (tx) => {
        const [current] = await tx
          .select()
          .from(staffMemberships)
          .where(eq(staffMemberships.id, id));
        if (!current) throw notFound("Staff member");
        // Prevents self-escalation, and guarantees an administrator can never lock the city out:
        // whoever makes a change keeps their own (administrative) access.
        if (current.userId === actor)
          throw forbidden("You cannot change your own access. Ask another administrator.");

        let roleName: string | undefined;
        if (input.roleId) {
          const [role] = await tx.select().from(roles).where(eq(roles.id, input.roleId));
          if (!role) throw unprocessable("invalid_role", "Choose a role from the list.");
          roleName = role.name;
        }
        if (input.departmentId) {
          const [department] = await tx
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.id, input.departmentId));
          if (!department)
            throw unprocessable("invalid_department", "Choose a department from the list.");
        }
        const changes = Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(changes).length === 0) return;
        await tx
          .update(staffMemberships)
          .set({ ...changes, updatedAt: new Date() })
          .where(and(eq(staffMemberships.id, id)));
        await recordAudit(tx, {
          ...auditBase(c),
          action: "staff.access_changed",
          entityType: "staff_membership",
          entityId: id,
          metadata: {
            subjectUserId: current.userId,
            before: {
              roleId: current.roleId,
              departmentId: current.departmentId,
              status: current.status,
            },
            after: {
              roleId: input.roleId ?? current.roleId,
              departmentId:
                input.departmentId === undefined ? current.departmentId : input.departmentId,
              status: input.status ?? current.status,
            },
          },
        });
        if ((input.status ?? current.status) === "active") {
          await tx.insert(notifications).values({
            municipalityId,
            channel: "in_app",
            recipientUserId: current.userId,
            subject: "Your access was updated",
            body: roleName
              ? `Your role is now ${roleName}.`
              : "An administrator changed your staff settings.",
            status: "sent",
            sentAt: new Date(),
          });
        }
      });
      return c.json(ok, 200);
    },
  );
}
