import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createDb } from "./client";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/** Applies pending migrations. Must run as the schema owner (DATABASE_MIGRATION_URL). */
export async function runMigrations(ownerUrl: string): Promise<void> {
  const { db, close } = createDb(ownerUrl, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

/** Drops everything and re-applies migrations. Development and test databases only. */
export async function resetDatabase(ownerUrl: string): Promise<void> {
  const name = new URL(ownerUrl).pathname.slice(1);
  if (!/_(dev|test)$/.test(name)) {
    throw new Error(`Refusing to reset database "${name}": name must end in _dev or _test.`);
  }
  const { db, close } = createDb(ownerUrl, { max: 1 });
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema public cascade`);
    await db.execute(sql`create schema public`);
  } finally {
    await close();
  }
  await runMigrations(ownerUrl);
}
