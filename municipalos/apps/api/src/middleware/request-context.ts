import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";

/**
 * Assigns a request id and determines the client address. The API is deployed behind the web
 * apps / a load balancer, which set X-Forwarded-For; it must not be exposed directly to the
 * internet without one, or clients could spoof the address used for rate limiting.
 */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  c.set("requestId", requestId);
  c.set("ip", forwarded && forwarded.length <= 45 ? forwarded : "unknown");
  c.header("x-request-id", requestId);
  await next();
});
