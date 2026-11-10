import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything queries can run against. */
export type Queryable = Db | Tx;

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

export function createDb(url: string, options: { max?: number } = {}): DbHandle {
  const client = postgres(url, { max: options.max ?? 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}

export interface TenantContext {
  municipalityId: string;
  /** The acting user, when there is one. Enables the "own membership" RLS policy. */
  userId?: string | null;
}

/**
 * Runs `fn` in a transaction scoped to one municipality. Row-level security policies read
 * `app.tenant_id`, so every statement inside can only see or write that tenant's rows — even
 * if a query forgets its WHERE clause. The setting is transaction-local and cannot leak to
 * other requests sharing the pooled connection.
 */
export function withTenant<T>(db: Db, ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.tenant_id', ${ctx.municipalityId}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Runs `fn` with only the acting user set (no tenant). Tenant tables are invisible except for
 * the user's own staff memberships. Used to answer "which municipalities can this user enter?".
 */
export function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.tenant_id', '', true), set_config('app.user_id', ${userId}, true)`,
    );
    return fn(tx);
  });
}

/** Refuses to run with a role that would bypass row-level security. */
export async function assertRuntimeRoleIsRestricted(db: Db): Promise<void> {
  const rows = await db.execute<{ rolsuper: boolean; rolbypassrls: boolean; owns: boolean }>(sql`
    select r.rolsuper, r.rolbypassrls,
           exists (select 1 from pg_tables t where t.schemaname = 'public' and t.tableowner = current_user) as owns
    from pg_roles r where r.rolname = current_user`);
  const row = rows[0];
  if (!row || row.rolsuper || row.rolbypassrls || row.owns) {
    throw new Error(
      "DATABASE_URL must use a restricted runtime role (not superuser, not BYPASSRLS, not table owner). " +
        "Tenant isolation depends on row-level security applying to this role.",
    );
  }
}
