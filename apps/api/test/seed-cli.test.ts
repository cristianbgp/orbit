import { describe, expect, test, vi } from "vitest";

import { DEMO_PASSWORD } from "../src/seed/demo-seed-data";
import { runDemoSeed } from "../src/seed";

const environment = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://localhost/orbit-test",
  BETTER_AUTH_SECRET: "a-secure-local-secret-with-32-characters",
  API_URL: "http://localhost:3000",
  CORS_ALLOWED_ORIGIN: "http://localhost:5173",
};

function createDependencies() {
  const end = vi.fn().mockResolvedValue(undefined);
  const createDatabase = vi.fn(() => ({ db: {}, client: { end } }));
  const hashPassword = vi.fn().mockResolvedValue("hashed-demo-password");
  const seedDatabase = vi.fn().mockResolvedValue({
    users: 2,
    members: 2,
    clients: 2,
    projects: 4,
    stages: 19,
    tasks: 5,
    projectAssignments: 6,
    taskAssignments: 5,
    activities: 4,
  });
  const log = vi.fn();
  return {
    dependencies: {
      createDatabase: createDatabase as never,
      hashPassword,
      seedDatabase: seedDatabase as never,
      log,
    },
    createDatabase,
    hashPassword,
    seedDatabase,
    end,
    log,
  };
}

describe("demo seed CLI", () => {
  test("rejects production before creating a database connection", async () => {
    const setup = createDependencies();

    await expect(
      runDemoSeed({
        environment: { ...environment, NODE_ENV: "production" },
        dependencies: setup.dependencies,
      }),
    ).rejects.toThrow("Demo seed is disabled in production.");
    expect(setup.createDatabase).not.toHaveBeenCalled();
    expect(setup.hashPassword).not.toHaveBeenCalled();
  });

  test("hashes the fixed password and seeds using the Lima calendar date", async () => {
    const setup = createDependencies();

    await runDemoSeed({
      environment,
      now: new Date("2026-08-07T03:00:00.000Z"),
      dependencies: setup.dependencies,
    });

    expect(setup.createDatabase).toHaveBeenCalledWith(environment.DATABASE_URL);
    expect(setup.hashPassword).toHaveBeenCalledWith(DEMO_PASSWORD);
    const fixture = setup.seedDatabase.mock.calls[0]?.[1];
    expect(fixture.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "demo-task-blocked",
          internalDueDate: "2026-08-06",
        }),
      ]),
    );
    expect(setup.seedDatabase).toHaveBeenCalledWith(
      expect.anything(),
      fixture,
      "hashed-demo-password",
    );
    expect(setup.end).toHaveBeenCalledOnce();
    expect(setup.log).toHaveBeenCalledWith(
      expect.stringContaining("demo@orbit.local"),
    );
    expect(setup.log).toHaveBeenCalledWith(
      expect.stringContaining("OrbitDemo123!"),
    );
  });

  test("closes PostgreSQL when seeding fails", async () => {
    const setup = createDependencies();
    setup.seedDatabase.mockRejectedValueOnce(new Error("seed failed"));

    await expect(
      runDemoSeed({ environment, dependencies: setup.dependencies }),
    ).rejects.toThrow("seed failed");
    expect(setup.end).toHaveBeenCalledOnce();
  });
});
