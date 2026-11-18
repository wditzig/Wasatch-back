import { serve } from "@hono/node-server";
import { assertRuntimeRoleIsRestricted, createDb } from "@municipalos/database";
import { ConsoleEmailTransport } from "@municipalos/notifications";
import { createApp } from "./app";
import { DEFAULT_RATE_LIMITS, scaleRateLimits } from "./context";
import { loadEnv } from "./env";
import { LocalDiskStorage } from "./lib/storage";
import { startOutboxWorker } from "./services/notify";

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
await assertRuntimeRoleIsRestricted(db);

const deps = {
  db,
  email: new ConsoleEmailTransport(),
  storage: new LocalDiskStorage(env.STORAGE_DIR),
  config: {
    sessionTtlHours: env.SESSION_TTL_HOURS,
    sessionIdleMinutes: env.SESSION_IDLE_MINUTES,
    publicSiteUrl: env.PUBLIC_SITE_URL,
    rateLimits: scaleRateLimits(DEFAULT_RATE_LIMITS, env.RATE_LIMIT_SCALE),
  },
};
const app = createApp(deps);

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.info(`[api] listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});

const stopOutbox = startOutboxWorker(deps);

const shutdown = () => {
  stopOutbox();
  server.close(() => void close().then(() => process.exit(0)));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
