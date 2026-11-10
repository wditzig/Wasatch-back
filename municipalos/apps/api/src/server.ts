import { serve } from "@hono/node-server";
import { assertRuntimeRoleIsRestricted, createDb } from "@municipalos/database";
import { ConsoleEmailTransport } from "@municipalos/notifications";
import { createApp } from "./app";
import { DEFAULT_RATE_LIMITS } from "./context";
import { loadEnv } from "./env";

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
await assertRuntimeRoleIsRestricted(db);

const app = createApp({
  db,
  email: new ConsoleEmailTransport(),
  config: { sessionTtlHours: env.SESSION_TTL_HOURS, publicSiteUrl: env.PUBLIC_SITE_URL, rateLimits: DEFAULT_RATE_LIMITS },
});

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.info(`[api] listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});

const shutdown = () => {
  server.close(() => void close().then(() => process.exit(0)));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
