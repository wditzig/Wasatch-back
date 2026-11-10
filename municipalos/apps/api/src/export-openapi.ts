/** Writes the OpenAPI document to docs/openapi.json without needing a database. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "@municipalos/database";
import { MemoryEmailTransport } from "@municipalos/notifications";
import { createApp } from "./app";
import { DEFAULT_RATE_LIMITS } from "./context";

const app = createApp({
  db: {} as Db,
  email: new MemoryEmailTransport(),
  config: {
    sessionTtlHours: 12,
    publicSiteUrl: "http://localhost:3000",
    rateLimits: DEFAULT_RATE_LIMITS,
  },
});
const res = await app.request("/openapi.json");
const out = fileURLToPath(new URL("../../../docs/openapi.json", import.meta.url));
writeFileSync(out, JSON.stringify(await res.json(), null, 2) + "\n");
console.info(`Wrote ${out}`);
