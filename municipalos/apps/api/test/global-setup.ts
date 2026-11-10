import { createDb } from "@municipalos/database";
import { resetDatabase } from "@municipalos/database/migrate";
import { seedDemo } from "@municipalos/database/seed";

const DEFAULT_OWNER =
  "postgres://municipalos_owner:dev_owner_password@localhost:5432/municipalos_test";

/** Rebuilds the test database from migrations and loads the synthetic seed once per run. */
export default async function setup() {
  const ownerUrl = process.env.TEST_DATABASE_MIGRATION_URL ?? DEFAULT_OWNER;
  await resetDatabase(ownerUrl);
  const { db, close } = createDb(ownerUrl, { max: 1 });
  try {
    await seedDemo(db);
  } finally {
    await close();
  }
}
