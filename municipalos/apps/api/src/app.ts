import { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "@municipalos/database";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { AppDeps, AppEnv } from "./context";
import { AppError } from "./errors";
import { RateLimiter } from "./middleware/rate-limit";
import { requestContext } from "./middleware/request-context";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { staffRoutes } from "./routes/staff";

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>();
  const limiter = new RateLimiter();

  app.use("*", requestContext);
  app.use("*", secureHeaders());
  app.use("*", bodyLimit({ maxSize: 64 * 1024 }));
  app.use("/v1/*", async (c, next) => {
    await next();
    // API responses can contain personal data; never let shared caches store them.
    c.header("Cache-Control", "no-store");
  });

  app.get("/healthz", async (c) => {
    await deps.db.execute(sql`select 1`);
    return c.json({ status: "ok" });
  });

  app.route("/v1/public", publicRoutes(deps, limiter));
  app.route("/v1/auth", authRoutes(deps, limiter));
  app.route("/v1/staff", staffRoutes(deps));

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "Opaque session token returned by POST /v1/auth/login.",
  });
  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "MunicipalOS API",
      version: "0.1.0",
      description:
        "Public endpoints need no authentication and never return private data. Staff endpoints are scoped to one municipality in the URL; access requires an active staff membership there.",
    },
  });

  app.notFound((c) =>
    c.json(
      { error: { code: "not_found", message: "Not found." }, requestId: c.get("requestId") },
      404,
    ),
  );

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    if (err instanceof AppError) {
      if (err.status === 429) {
        const retry = (err.details as { retryAfterSeconds?: number } | undefined)
          ?.retryAfterSeconds;
        if (retry) c.header("Retry-After", String(retry));
      }
      return c.json(
        { error: { code: err.code, message: err.message, details: err.details }, requestId },
        err.status,
      );
    }
    if (err instanceof SyntaxError || (err as { status?: number }).status === 400) {
      return c.json(
        { error: { code: "bad_request", message: "The request could not be read." }, requestId },
        400,
      );
    }
    if ((err as { status?: number }).status === 413) {
      return c.json(
        { error: { code: "payload_too_large", message: "The request is too large." }, requestId },
        413,
      );
    }
    // Unexpected: log with the request id, return nothing internal to the client.
    console.error(
      `[api] unhandled error requestId=${requestId} ${c.req.method} ${c.req.path}`,
      err,
    );
    return c.json(
      {
        error: { code: "internal_error", message: "Something went wrong on our side." },
        requestId,
      },
      500,
    );
  });

  return app;
}
