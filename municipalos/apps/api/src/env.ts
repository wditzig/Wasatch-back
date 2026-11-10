import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(12),
  EMAIL_TRANSPORT: z.enum(["console"]).default("console"),
  /** Public origin of the resident website, used to build tracking links in notifications. */
  /** Multiplies every rate limit. Leave at 1 except for automated end-to-end test runs. */
  RATE_LIMIT_SCALE: z.coerce.number().int().min(1).max(1000).default(1),
  PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

/** Validates process.env once at startup; exits with a readable message when misconfigured. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}
