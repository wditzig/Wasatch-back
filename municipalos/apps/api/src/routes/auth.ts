import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { dummyPasswordHash, generateSessionToken, hashSessionToken, verifyPassword } from "@municipalos/auth";
import { and, asc, eq, municipalities, sessions, staffMemberships, users, withUser } from "@municipalos/database";
import { loginSchema } from "@municipalos/validation";
import type { AppDeps, AppEnv } from "../context";
import { AppError } from "../errors";
import { recordAudit } from "../lib/audit";
import { requireSession } from "../middleware/auth";
import { enforceRateLimit, rateLimit, type RateLimiter } from "../middleware/rate-limit";
import { body, errorResponses, json, meSchema, okSchema, userSchema } from "../schemas";
import { validationHook } from "../validation-hook";

const tags = ["Auth"];

export function authRoutes(deps: AppDeps, limiter: RateLimiter) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  app.use("/login", rateLimit(limiter, "login-ip", deps.config.rateLimits.login));
  app.openapi(
    createRoute({
      method: "post", path: "/login", tags,
      summary: "Sign in with email and password",
      description: "Development/test identity provider. Returns an opaque bearer token; only its hash is stored.",
      request: { body: body(loginSchema) },
      responses: {
        200: json(z.object({ token: z.string(), expiresAt: z.string(), user: userSchema }), "Signed in"),
        ...errorResponses,
      },
    }),
    async (c) => {
      const { email, password } = c.req.valid("json");
      const meta = { ip: c.get("ip"), requestId: c.get("requestId") };
      // Throttle per account as well as per address, so a distributed guesser is slowed too.
      enforceRateLimit(limiter, `login-account:${email.toLowerCase()}`, deps.config.rateLimits.login);

      const [user] = await deps.db.select().from(users).where(eq(users.email, email));
      // Always run a hash comparison so response time does not reveal whether the account exists.
      const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyPasswordHash()));
      if (!user || !valid || user.status !== "active") {
        await recordAudit(deps.db, {
          municipalityId: null,
          actorKind: "anonymous",
          actorUserId: user?.id ?? null,
          action: "auth.login_failed",
          ...meta,
        });
        throw new AppError(401, "invalid_credentials", "The email or password is incorrect.");
      }

      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + deps.config.sessionTtlHours * 3_600_000);
      await deps.db.insert(sessions).values({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        ip: meta.ip,
        userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
      });
      await recordAudit(deps.db, { municipalityId: null, actorKind: "staff", actorUserId: user.id, action: "auth.login", ...meta });
      return c.json(
        { token, expiresAt: expiresAt.toISOString(), user: { id: user.id, email: user.email, name: user.name } },
        200,
      );
    },
  );

  app.use("/logout", requireSession(deps));
  app.openapi(
    createRoute({
      method: "post", path: "/logout", tags, security: [{ bearerAuth: [] }],
      summary: "Revoke the current session",
      responses: { 200: json(okSchema, "Signed out"), ...errorResponses },
    }),
    async (c) => {
      const auth = c.get("auth");
      await deps.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, auth.sessionId));
      await recordAudit(deps.db, {
        municipalityId: null, actorKind: "staff", actorUserId: auth.user.id, action: "auth.logout",
        ip: c.get("ip"), requestId: c.get("requestId"),
      });
      return c.json({ ok: true as const }, 200);
    },
  );

  app.use("/me", requireSession(deps));
  app.openapi(
    createRoute({
      method: "get", path: "/me", tags, security: [{ bearerAuth: [] }],
      summary: "Current user and the municipalities they work for",
      responses: { 200: json(meSchema, "Current user"), ...errorResponses },
    }),
    async (c) => {
      const { user } = c.get("auth");
      const memberships = await withUser(deps.db, user.id, (tx) =>
        tx
          .select({ slug: municipalities.slug, name: municipalities.name, state: municipalities.state, title: staffMemberships.title })
          .from(staffMemberships)
          .innerJoin(municipalities, eq(municipalities.id, staffMemberships.municipalityId))
          .where(and(eq(staffMemberships.userId, user.id), eq(staffMemberships.status, "active"), eq(municipalities.status, "active")))
          .orderBy(asc(municipalities.name)),
      );
      return c.json(
        {
          user: { id: user.id, email: user.email, name: user.name },
          memberships: memberships.map((m) => ({ municipality: { slug: m.slug, name: m.name, state: m.state }, title: m.title })),
        },
        200,
      );
    },
  );

  return app;
}
