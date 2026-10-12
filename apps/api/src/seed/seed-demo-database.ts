import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";

import * as schema from "../db/schema";
import {
  account,
  client,
  member,
  organization,
  project,
  projectActivity,
  projectAssignment,
  projectEvent,
  projectStage,
  projectTask,
  taskAssignment,
  user,
  legalCases,
  caseAssignments,
  caseActivities,
  caseUpdates,
  caseActions,
  caseEvents,
} from "../db/schema";
import type { DemoSeedData } from "./demo-seed-data";

export type DemoSeedDatabase = Pick<
  PostgresJsDatabase<typeof schema>,
  "transaction"
>;

export type DemoSeedResult = {
  users: number;
  members: number;
  clients: number;
  projects: number;
  projectEvents: number;
  stages: number;
  tasks: number;
  projectAssignments: number;
  taskAssignments: number;
  activities: number;
  cases: number;
  caseAssignments: number;
  caseActivities: number;
  caseUpdates: number;
  caseActions: number;
  caseEvents: number;
};

export function assertLocalSeedEnvironment(nodeEnv: string | undefined) {
  if (nodeEnv === "production") {
    throw new Error("Demo seed is disabled in production.");
  }
}

export async function seedDemoDatabase(
  database: DemoSeedDatabase,
  fixture: DemoSeedData,
  passwordHash: string,
): Promise<DemoSeedResult> {
  await database.transaction(async (transaction) => {
    await transaction.insert(user).values(fixture.users).onConflictDoNothing();
    await transaction
      .insert(account)
      .values({ ...fixture.credentialAccount, password: passwordHash })
      .onConflictDoNothing();
    await transaction
      .insert(organization)
      .values(fixture.organizations)
      .onConflictDoNothing();
    await transaction
      .insert(member)
      .values(fixture.members)
      .onConflictDoNothing();
    await transaction
      .insert(client)
      .values(fixture.clients)
      .onConflictDoNothing();
    await transaction
      .insert(project)
      .values(fixture.projects)
      .onConflictDoNothing();
    await transaction
      .delete(projectEvent)
      .where(
        inArray(projectEvent.id, [
          "legacy-legal:demo-project-other",
          ...fixture.projectEvents.map(({ id }) => id),
        ]),
      );
    await transaction.insert(projectEvent).values(fixture.projectEvents);
    await transaction
      .insert(projectStage)
      .values(fixture.stages)
      .onConflictDoNothing();
    await transaction
      .insert(projectAssignment)
      .values(fixture.projectAssignments)
      .onConflictDoNothing();
    await transaction
      .insert(projectTask)
      .values(fixture.tasks)
      .onConflictDoNothing();
    await transaction
      .insert(taskAssignment)
      .values(fixture.taskAssignments)
      .onConflictDoNothing();
    await transaction
      .insert(projectActivity)
      .values(fixture.activities)
      .onConflictDoNothing();
    await transaction
      .insert(legalCases)
      .values(fixture.cases)
      .onConflictDoNothing();
    await transaction
      .insert(caseAssignments)
      .values(fixture.caseAssignments)
      .onConflictDoNothing();
    await transaction
      .insert(caseActions)
      .values(fixture.caseActions)
      .onConflictDoNothing();
    await transaction
      .insert(caseEvents)
      .values(fixture.caseEvents)
      .onConflictDoNothing();
    await transaction
      .insert(caseActivities)
      .values(fixture.caseActivities)
      .onConflictDoNothing();
    await transaction
      .insert(caseUpdates)
      .values(fixture.caseUpdates)
      .onConflictDoNothing();
  });

  return {
    users: fixture.users.length,
    members: fixture.members.length,
    clients: fixture.clients.length,
    projects: fixture.projects.length,
    projectEvents: fixture.projectEvents.length,
    stages: fixture.stages.length,
    tasks: fixture.tasks.length,
    projectAssignments: fixture.projectAssignments.length,
    taskAssignments: fixture.taskAssignments.length,
    activities: fixture.activities.length,
    cases: fixture.cases.length,
    caseAssignments: fixture.caseAssignments.length,
    caseActivities: fixture.caseActivities.length,
    caseUpdates: fixture.caseUpdates.length,
    caseActions: fixture.caseActions.length,
    caseEvents: fixture.caseEvents.length,
  };
}
