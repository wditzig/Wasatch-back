import { createDb } from "./client";
import { resetDatabase, runMigrations } from "./migrate";
import { seedDemo } from "./seed";

const command = process.argv[2];
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
if (!ownerUrl) {
  console.error("DATABASE_MIGRATION_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

async function seed(url: string) {
  const { db, close } = createDb(url, { max: 1 });
  try {
    const summary = await seedDemo(db);
    console.info(`Seeded synthetic demo data: ${JSON.stringify(summary)}`);
  } finally {
    await close();
  }
}

switch (command) {
  case "migrate":
    await runMigrations(ownerUrl);
    console.info("Migrations applied.");
    break;
  case "seed":
    await seed(ownerUrl);
    break;
  case "reset":
    await resetDatabase(ownerUrl);
    await seed(ownerUrl);
    break;
  default:
    console.error("Usage: cli.ts migrate | seed | reset");
    process.exit(1);
}
