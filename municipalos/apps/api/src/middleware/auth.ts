import { hashSessionToken } from "@municipalos/auth";
import {
  and, eq, gt, isNull, municipalities, rolePermissions, roles, sessions, staffMemberships, users, withTenant,
} from "@municipalos/database";
import { toPermissionSet, type Permission } from "@municipalos/permissions";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppDeps, AppEnv, Municipality } from "../context";
import { forbidden, notFound, unauthorized } from "../errors";
import { recordAudit } from "../lib/audit";

export function bearerToken(c: Context): string | null {
  const header = c.req.header("authorization");
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]{20,200})$/);
  return match?.[1] ?? null;
}

/** Resolves the bearer token to an active session and user. */
export function requireSession(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = bearerToken(c);
    if (!token) throw unauthorized();
    const [row] = await deps.db
      .select({
        sessionId: sessions.id,
        lastSeenAt: sessions.lastSeenAt,
        id: users.id,
        email: users.email,
        name: users.name,
        isPlatformAdmin: users.isPlatformAdmin,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, hashSessionToken(token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
          eq(users.status, "active"),
        ),
      );
    if (!row) throw unauthorized();
    if (Date.now() - row.lastSeenAt.getTime() > 5 * 60_000) {
      await deps.db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.sessionId));
    }
    c.set("auth", {
      sessionId: row.sessionId,
      user: { id: row.id, email: row.email, name: row.name, isPlatformAdmin: row.isPlatformAdmin },
    });
    await next();
  });
}

export async function findActiveMunicipality(deps: AppDeps, slug: string): Promise<Municipality | undefined> {
  const [row] = await deps.db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      name: municipalities.name,
      state: municipalities.state,
      referencePrefix: municipalities.referencePrefix,
    })
    .from(municipalities)
    .where(and(eq(municipalities.slug, slug), eq(municipalities.status, "active")));
  return row;
}

/**
 * Tenant gate for /v1/staff/:slug/*. The slug in the URL is only a *request* to act in that
 * municipality: access is granted solely by an active staff membership found in the database
 * for the authenticated user. Platform administrators get no implicit access.
 */
export function requireStaff(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { user } = c.get("auth");
    const municipality = await findActiveMunicipality(deps, c.req.param("slug") ?? "");
    if (!municipality) throw notFound("Municipality");

    const staff = await withTenant(deps.db, { municipalityId: municipality.id, userId: user.id }, async (tx) => {
      const [membership] = await tx
        .select({
          id: staffMemberships.id,
          departmentId: staffMemberships.departmentId,
          title: staffMemberships.title,
          roleId: roles.id,
          roleKey: roles.key,
          roleName: roles.name,
        })
        .from(staffMemberships)
        .innerJoin(roles, eq(roles.id, staffMemberships.roleId))
        .where(and(eq(staffMemberships.userId, user.id), eq(staffMemberships.status, "active")));
      if (!membership) {
        await recordAudit(tx, {
          municipalityId: municipality.id,
          actorKind: "staff",
          actorUserId: user.id,
          action: "authz.tenant_access_denied",
          metadata: { path: c.req.path, method: c.req.method },
          ip: c.get("ip"),
          requestId: c.get("requestId"),
        });
        return null;
      }
      const perms = await tx
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, membership.roleId));
      return { membership, permissions: toPermissionSet(perms.map((p) => p.permission)) };
    });
    if (!staff) throw forbidden("You are not a staff member of this municipality.");

    c.set("staff", {
      municipality,
      membership: {
        id: staff.membership.id,
        departmentId: staff.membership.departmentId,
        title: staff.membership.title,
        roleKey: staff.membership.roleKey,
        roleName: staff.membership.roleName,
      },
      permissions: staff.permissions,
    });
    await next();
  });
}

export function assertCan(c: Context<AppEnv>, permission: Permission): void {
  if (!c.get("staff").permissions.has(permission)) throw forbidden();
}
