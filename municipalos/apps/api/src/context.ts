import type { Db } from "@municipalos/database";
import type { EmailTransport } from "@municipalos/notifications";
import type { PermissionSet } from "@municipalos/permissions";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface AppConfig {
  sessionTtlHours: number;
  publicSiteUrl: string;
  rateLimits: Record<"login" | "publicSubmit" | "publicMessage" | "publicRead", RateLimitRule>;
}

export const DEFAULT_RATE_LIMITS: AppConfig["rateLimits"] = {
  login: { limit: 10, windowMs: 5 * 60_000 },
  publicSubmit: { limit: 10, windowMs: 10 * 60_000 },
  publicMessage: { limit: 20, windowMs: 10 * 60_000 },
  publicRead: { limit: 300, windowMs: 60_000 },
};

export function scaleRateLimits(
  limits: AppConfig["rateLimits"],
  scale: number,
): AppConfig["rateLimits"] {
  return Object.fromEntries(
    Object.entries(limits).map(([k, rule]) => [k, { ...rule, limit: rule.limit * scale }]),
  ) as AppConfig["rateLimits"];
}

export interface AppDeps {
  db: Db;
  email: EmailTransport;
  config: AppConfig;
}

export interface AuthContext {
  sessionId: string;
  user: { id: string; email: string; name: string; isPlatformAdmin: boolean };
}

export interface Municipality {
  id: string;
  slug: string;
  name: string;
  state: string;
  timezone: string;
  referencePrefix: string;
}

export interface StaffContext {
  municipality: Municipality;
  membership: {
    id: string;
    departmentId: string | null;
    title: string | null;
    roleKey: string;
    roleName: string;
  };
  permissions: PermissionSet;
}

export type AppEnv = {
  Variables: {
    requestId: string;
    ip: string;
    auth: AuthContext;
    staff: StaffContext;
  };
};
