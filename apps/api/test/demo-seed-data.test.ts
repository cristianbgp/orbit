import { describe, expect, test } from "vitest";

import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  buildDemoSeedData,
} from "../src/seed/demo-seed-data";

describe("demo seed data", () => {
  test("builds a connected studio fixture for every project type", () => {
    const fixture = buildDemoSeedData("2026-08-07");

    expect(DEMO_EMAIL).toBe("demo@orbit.local");
    expect(DEMO_PASSWORD).toBe("OrbitDemo123!");
    expect(fixture.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "demo-user-owner",
          email: DEMO_EMAIL,
          emailVerified: true,
          alias: "DO",
        }),
        expect.objectContaining({
          id: "demo-user-teammate",
          alias: "AM",
        }),
      ]),
    );
    expect(fixture.credentialAccount).toMatchObject({
      userId: "demo-user-owner",
      accountId: "demo-user-owner",
      providerId: "credential",
    });
    expect(fixture.organizations).toEqual([
      expect.objectContaining({
        id: "demo-organization",
        slug: "orbit-demo-local",
        timeZone: "America/Lima",
      }),
    ]);
    expect(fixture.members).toHaveLength(2);
    expect(new Set(fixture.clients.map(({ type }) => type))).toEqual(
      new Set(["person", "company"]),
    );
    expect(fixture.projects.map(({ type }) => type)).toEqual([
      "written_submission",
      "consultation",
      "oral_argument",
      "other",
    ]);
    expect(fixture.projects.map(({ endDate }) => endDate)).toEqual([
      "2026-08-12",
      "2026-08-19",
      "2026-08-08",
      "2026-08-27",
    ]);
    expect(
      fixture.projectEvents.map(({ id, projectId, type, date }) => ({
        id,
        projectId,
        type,
        date,
      })),
    ).toEqual([
      {
        id: "legacy-legal:demo-project-written",
        projectId: "demo-project-written",
        type: "legal",
        date: "2026-08-09",
      },
      {
        id: "legacy-legal:demo-project-consultation",
        projectId: "demo-project-consultation",
        type: "legal",
        date: "2026-08-25",
      },
      {
        id: "legacy-legal:demo-project-oral",
        projectId: "demo-project-oral",
        type: "legal",
        date: "2026-08-11",
      },
      {
        id: "demo-event-oral-preparation",
        projectId: "demo-project-oral",
        type: "legal",
        date: "2026-08-07",
      },
    ]);
    expect(
      fixture.projectEvents.some(
        ({ projectId }) => projectId === "demo-project-other",
      ),
    ).toBe(false);
    expect(fixture.cases).toHaveLength(2);
    expect(fixture.cases.map(({ status }) => status)).toEqual([
      "in_progress",
      "concluded",
    ]);
    expect(fixture.caseAssignments).toHaveLength(3);
    expect(
      fixture.caseAssignments.map(({ responsibility }) => responsibility),
    ).toEqual(["member", "member", "follower"]);
    expect(new Set(fixture.caseEvents.map(({ type }) => type))).toEqual(
      new Set(["oral_argument", "interview", "other"]),
    );
    expect(fixture.caseEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "demo-case-event-oral-argument",
          caseId: "demo-case-bbva",
          title: "Informe oral ante la Sala",
          type: "oral_argument",
          date: "2026-08-10",
        }),
      ]),
    );
  });

  test("copies canonical stages and adds a small manual Other structure", () => {
    const fixture = buildDemoSeedData("2026-08-07");

    const stagesByProject = fixture.stages.reduce((grouped, stage) => {
      const current = grouped.get(stage.projectId) ?? [];
      current.push(stage);
      grouped.set(stage.projectId, current);
      return grouped;
    }, new Map<string, typeof fixture.stages>());
    expect(
      stagesByProject.get("demo-project-written")?.map(({ name }) => name),
    ).toEqual([
      "Investigación y análisis",
      "Estrategia",
      "Redacción",
      "Revisión de socios",
      "Envío al cliente",
      "Presentación",
    ]);
    expect(
      stagesByProject.get("demo-project-consultation")?.map(({ name }) => name),
    ).toEqual([
      "Investigación y análisis",
      "Enfoque",
      "Redacción",
      "Revisión de socios",
      "Envío al cliente",
    ]);
    expect(
      stagesByProject.get("demo-project-oral")?.map(({ name }) => name),
    ).toEqual([
      "Acreditación",
      "Investigación y análisis",
      "Presentación",
      "Informe oral",
      "Alegatos",
      "Salida",
    ]);
    expect(
      stagesByProject.get("demo-project-other")?.map(({ name }) => name),
    ).toEqual(["Preparación", "Ejecución"]);
  });

  test("includes varied scheduled work, responsibilities, and activity", () => {
    const fixture = buildDemoSeedData("2026-08-07");

    expect(new Set(fixture.tasks.map(({ status }) => status))).toEqual(
      new Set(["pending", "in_progress", "blocked", "completed"]),
    );
    expect(fixture.tasks.map(({ internalDueDate }) => internalDueDate)).toEqual(
      expect.arrayContaining(["2026-08-06", "2026-08-07", "2026-08-10"]),
    );
    expect(fixture.tasks.every(({ position }) => position === 0)).toBe(true);
    expect(fixture.projectAssignments.length).toBeGreaterThanOrEqual(4);
    expect(fixture.taskAssignments.length).toBeGreaterThanOrEqual(4);
    expect(fixture.activities.map(({ type }) => type)).toEqual(
      expect.arrayContaining([
        "project_assignment.added",
        "task.created",
        "task_assignment.added",
        "task.status_changed",
      ]),
    );

    const projectIds = new Set(fixture.projects.map(({ id }) => id));
    const stageIds = new Set(fixture.stages.map(({ id }) => id));
    expect(
      fixture.tasks.every(
        ({ projectId, stageId }) =>
          projectIds.has(projectId) && stageIds.has(stageId),
      ),
    ).toBe(true);
  });
});
