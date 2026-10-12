import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  account,
  client,
  invitation,
  member,
  organization,
  project,
  projectActivity,
  projectAssignment,
  projectEvent,
  projectStage,
  projectTask,
  session,
  taskAssignment,
  user,
  verification,
} from "../src/db/schema";

const instantColumns = [
  [user, ["createdAt", "updatedAt"]],
  [session, ["expiresAt", "createdAt", "updatedAt"]],
  [
    account,
    ["accessTokenExpiresAt", "refreshTokenExpiresAt", "createdAt", "updatedAt"],
  ],
  [verification, ["expiresAt", "createdAt", "updatedAt"]],
  [organization, ["createdAt"]],
  [member, ["createdAt"]],
  [invitation, ["expiresAt", "createdAt"]],
  [client, ["createdAt", "updatedAt"]],
  [project, ["archivedAt", "createdAt", "updatedAt"]],
  [projectStage, ["createdAt", "updatedAt"]],
  [projectEvent, ["createdAt", "updatedAt"]],
  [projectTask, ["archivedAt", "createdAt", "updatedAt"]],
  [projectAssignment, ["assignedAt", "endedAt"]],
  [taskAssignment, ["assignedAt", "endedAt"]],
  [projectActivity, ["createdAt"]],
] as const;

describe("temporal schema contract", () => {
  test("uses timestamptz for every real instant", () => {
    for (const [table, keys] of instantColumns) {
      const columns = getTableColumns(table) as Record<
        string,
        { getSQLType(): string; withTimezone?: boolean }
      >;
      for (const key of keys) {
        expect({
          sqlType: columns[key]!.getSQLType(),
          withTimezone: columns[key]!.withTimezone,
        }).toMatchObject({
          sqlType: "timestamp with time zone",
          withTimezone: true,
        });
      }
    }
  });

  test("keeps calendar dates independent from time zones", () => {
    expect(getTableColumns(project).startDate.getSQLType()).toBe("date");
    expect(getTableColumns(project).endDate.getSQLType()).toBe("date");
    expect(getTableColumns(projectEvent).date.getSQLType()).toBe("date");
    expect(getTableColumns(projectTask).plannedStartDate.getSQLType()).toBe(
      "date",
    );
    expect(getTableColumns(projectTask).internalDueDate.getSQLType()).toBe(
      "date",
    );
  });
});
