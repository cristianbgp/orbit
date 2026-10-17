import { hashPassword } from "better-auth/crypto";

import { readServerConfig } from "./config";
import { createDatabase } from "./db/client";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  buildDemoSeedData,
} from "./seed/demo-seed-data";
import {
  assertLocalSeedEnvironment,
  seedDemoDatabase,
} from "./seed/seed-demo-database";

type SeedDependencies = {
  createDatabase: typeof createDatabase;
  hashPassword: typeof hashPassword;
  seedDatabase: typeof seedDemoDatabase;
  log(message: string): void;
};

type RunDemoSeedOptions = {
  environment?: Record<string, string | undefined>;
  now?: Date;
  dependencies?: SeedDependencies;
};

const defaultDependencies: SeedDependencies = {
  createDatabase,
  hashPassword,
  seedDatabase: seedDemoDatabase,
  log: console.info,
};

function limaCalendarDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export async function runDemoSeed({
  environment = process.env,
  now = new Date(),
  dependencies = defaultDependencies,
}: RunDemoSeedOptions = {}) {
  assertLocalSeedEnvironment(environment.NODE_ENV);
  const config = readServerConfig(environment);
  const database = dependencies.createDatabase(config.databaseUrl);

  try {
    const passwordHash = await dependencies.hashPassword(DEMO_PASSWORD);
    const fixture = buildDemoSeedData(limaCalendarDate(now));
    const result = await dependencies.seedDatabase(
      database.db,
      fixture,
      passwordHash,
    );
    dependencies.log(
      `Demo fixture ready: ${result.projects} projects, ${result.tasks} tasks, ${result.activities} activities.`,
    );
    dependencies.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    return result;
  } finally {
    await database.client.end();
  }
}

if (import.meta.main) {
  void runDemoSeed().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
