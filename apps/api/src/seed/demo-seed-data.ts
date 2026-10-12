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
import { getDefaultProjectStages } from "../projects/project-stage-defaults";
import type { ProjectType } from "../projects/project-types";
import { legacyProjectLegalEventId } from "../project-events/legacy-project-event";

export const DEMO_EMAIL = "demo@orbit.local";
export const DEMO_PASSWORD = "OrbitDemo123!";

type CredentialAccount = Omit<typeof account.$inferInsert, "password">;

export type DemoSeedData = {
  users: (typeof user.$inferInsert)[];
  credentialAccount: CredentialAccount;
  organizations: (typeof organization.$inferInsert)[];
  members: (typeof member.$inferInsert)[];
  clients: (typeof client.$inferInsert)[];
  projects: (typeof project.$inferInsert)[];
  projectEvents: (typeof projectEvent.$inferInsert)[];
  stages: (typeof projectStage.$inferInsert)[];
  tasks: (typeof projectTask.$inferInsert)[];
  projectAssignments: (typeof projectAssignment.$inferInsert)[];
  taskAssignments: (typeof taskAssignment.$inferInsert)[];
  activities: (typeof projectActivity.$inferInsert)[];
  cases: (typeof legalCases.$inferInsert)[];
  caseAssignments: (typeof caseAssignments.$inferInsert)[];
  caseActivities: (typeof caseActivities.$inferInsert)[];
  caseUpdates: (typeof caseUpdates.$inferInsert)[];
  caseActions: (typeof caseActions.$inferInsert)[];
  caseEvents: (typeof caseEvents.$inferInsert)[];
};

function calendarDate(baseDate: string, offset: number) {
  const date = new Date(`${baseDate}T12:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid seed base date");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function instant(baseDate: string, offset: number, hour = 15) {
  return new Date(
    `${calendarDate(baseDate, offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`,
  );
}

const PROJECTS: ReadonlyArray<{
  id: string;
  type: ProjectType;
  clientId: string;
  name: string;
  startOffset: number;
  internalOffset: number;
  legalOffset: number;
  status: "draft" | "active";
}> = [
  {
    id: "demo-project-written",
    type: "written_submission",
    clientId: "demo-client-company",
    name: "Recurso de apelación – expediente demo",
    startOffset: -14,
    internalOffset: 5,
    legalOffset: 2,
    status: "active",
  },
  {
    id: "demo-project-consultation",
    type: "consultation",
    clientId: "demo-client-person",
    name: "Consulta sobre cumplimiento contractual",
    startOffset: -5,
    internalOffset: 12,
    legalOffset: 18,
    status: "active",
  },
  {
    id: "demo-project-oral",
    type: "oral_argument",
    clientId: "demo-client-company",
    name: "Informe oral ante sala superior",
    startOffset: -10,
    internalOffset: 1,
    legalOffset: 4,
    status: "active",
  },
  {
    id: "demo-project-other",
    type: "other",
    clientId: "demo-client-person",
    name: "Proyecto especial de coordinación",
    startOffset: 0,
    internalOffset: 20,
    legalOffset: 30,
    status: "draft",
  },
];

function stageDefaults(type: ProjectType) {
  if (type !== "other") return getDefaultProjectStages(type);
  return [
    { name: "Preparación", description: "Definir alcance y encargados." },
    { name: "Ejecución", description: "Realizar y documentar el trabajo." },
  ];
}

export function buildDemoSeedData(baseDate: string): DemoSeedData {
  const createdAt = instant(baseDate, -30);
  const owner = {
    id: "demo-user-owner",
    name: "Demo Orbit",
    email: DEMO_EMAIL,
    emailVerified: true,
    alias: "DO",
    createdAt,
    updatedAt: createdAt,
  } satisfies typeof user.$inferInsert;
  const teammate = {
    id: "demo-user-teammate",
    name: "Andrea Mendoza",
    email: "andrea@orbit.local",
    emailVerified: true,
    alias: "AM",
    createdAt,
    updatedAt: createdAt,
  } satisfies typeof user.$inferInsert;

  const projects: DemoSeedData["projects"] = PROJECTS.map((item) => ({
    id: item.id,
    organizationId: "demo-organization",
    clientId: item.clientId,
    name: item.name,
    type: item.type,
    status: item.status,
    startDate: calendarDate(baseDate, item.startOffset),
    endDate: calendarDate(baseDate, item.internalOffset),
    internalReference: `DEMO-${item.type.toUpperCase()}`,
    description: "Datos de demostración para desarrollo local.",
    createdAt: instant(baseDate, item.startOffset),
    updatedAt: instant(baseDate, -1),
  }));

  const projectEvents: DemoSeedData["projectEvents"] = [
    ...PROJECTS.filter((item) => item.id !== "demo-project-other").map(
      (item) => ({
        id: legacyProjectLegalEventId(item.id),
        organizationId: "demo-organization",
        projectId: item.id,
        title: "Fecha legal",
        type: "legal" as const,
        date: calendarDate(baseDate, item.legalOffset),
        description: null,
        createdByUserId: owner.id,
        createdAt: instant(baseDate, item.startOffset),
        updatedAt: instant(baseDate, -1),
      }),
    ),
    {
      id: "demo-event-oral-preparation",
      organizationId: "demo-organization",
      projectId: "demo-project-oral",
      title: "Reunión de preparación",
      type: "legal" as const,
      date: calendarDate(baseDate, 0),
      description: "Segundo evento legal para probar calendarios densos.",
      createdByUserId: owner.id,
      createdAt: instant(baseDate, -4),
      updatedAt: instant(baseDate, -1),
    },
  ];

  const stages: DemoSeedData["stages"] = PROJECTS.flatMap((item) =>
    stageDefaults(item.type).map((stage, position) => ({
      id: `${item.id}-stage-${position + 1}`,
      organizationId: "demo-organization",
      projectId: item.id,
      name: stage.name,
      description: stage.description,
      position,
      createdAt: instant(baseDate, item.startOffset),
      updatedAt: instant(baseDate, item.startOffset),
    })),
  );

  const tasks = [
    {
      id: "demo-task-completed",
      projectId: "demo-project-written",
      stageId: "demo-project-written-stage-1",
      title: "Revisar expediente y antecedentes",
      status: "completed" as const,
      plannedStartDate: calendarDate(baseDate, -10),
      internalDueDate: calendarDate(baseDate, -1),
    },
    {
      id: "demo-task-progress",
      projectId: "demo-project-written",
      stageId: "demo-project-written-stage-3",
      title: "Preparar primera versión del escrito",
      status: "in_progress" as const,
      plannedStartDate: calendarDate(baseDate, -2),
      internalDueDate: calendarDate(baseDate, 3),
    },
    {
      id: "demo-task-pending",
      projectId: "demo-project-consultation",
      stageId: "demo-project-consultation-stage-1",
      title: "Analizar antecedentes contractuales",
      status: "pending" as const,
      plannedStartDate: calendarDate(baseDate, 2),
      internalDueDate: calendarDate(baseDate, 10),
    },
    {
      id: "demo-task-blocked",
      projectId: "demo-project-oral",
      stageId: "demo-project-oral-stage-3",
      title: "Cerrar presentación para el informe",
      status: "blocked" as const,
      plannedStartDate: calendarDate(baseDate, -3),
      internalDueDate: calendarDate(baseDate, 0),
    },
    {
      id: "demo-task-other",
      projectId: "demo-project-other",
      stageId: "demo-project-other-stage-1",
      title: "Definir alcance del proyecto",
      status: "in_progress" as const,
      plannedStartDate: calendarDate(baseDate, 0),
      internalDueDate: calendarDate(baseDate, 7),
    },
  ].map((task, index) => ({
    ...task,
    organizationId: "demo-organization",
    description: "Tarea de demostración para validar el flujo de tareas.",
    position: 0,
    createdByUserId: owner.id,
    createdByNameSnapshot: owner.name,
    createdAt: instant(baseDate, -4, 14 + (index % 3)),
    updatedAt: instant(baseDate, -1),
  })) satisfies DemoSeedData["tasks"];

  const projectAssignments = PROJECTS.flatMap((item, projectIndex) => [
    {
      id: `${item.id}-assignment-owner`,
      organizationId: "demo-organization",
      projectId: item.id,
      userId: owner.id,
      userNameSnapshot: owner.name,
      userEmailSnapshot: owner.email,
      responsibility: "responsible" as const,
      assignedByUserId: owner.id,
      assignedByNameSnapshot: owner.name,
      assignedAt: instant(baseDate, item.startOffset, 14),
    },
    ...(projectIndex % 2 === 0
      ? [
          {
            id: `${item.id}-assignment-teammate`,
            organizationId: "demo-organization",
            projectId: item.id,
            userId: teammate.id,
            userNameSnapshot: teammate.name,
            userEmailSnapshot: teammate.email,
            responsibility: "member" as const,
            assignedByUserId: owner.id,
            assignedByNameSnapshot: owner.name,
            assignedAt: instant(baseDate, item.startOffset, 15),
          },
        ]
      : []),
  ]) satisfies DemoSeedData["projectAssignments"];

  const taskAssignments = tasks.map((task, index) => {
    const assignedUser = index % 2 === 0 ? owner : teammate;
    return {
      id: `${task.id}-assignment`,
      organizationId: "demo-organization",
      projectId: task.projectId,
      taskId: task.id,
      userId: assignedUser.id,
      userNameSnapshot: assignedUser.name,
      userEmailSnapshot: assignedUser.email,
      assignedByUserId: owner.id,
      assignedByNameSnapshot: owner.name,
      assignedAt: instant(baseDate, -4, 16),
    };
  }) satisfies DemoSeedData["taskAssignments"];

  function activity(
    values: Omit<
      typeof projectActivity.$inferInsert,
      "organizationId" | "actorUserId" | "actorNameSnapshot" | "createdAt"
    >,
    index: number,
  ): typeof projectActivity.$inferInsert {
    return {
      ...values,
      organizationId: "demo-organization",
      actorUserId: owner.id,
      actorNameSnapshot: owner.name,
      createdAt: instant(baseDate, -3 + index, 15),
    };
  }

  const activities: DemoSeedData["activities"] = [
    activity(
      {
        id: "demo-activity-project-assignment",
        projectId: "demo-project-written",
        type: "project_assignment.added",
        subjectUserId: teammate.id,
        subjectNameSnapshot: teammate.name,
        details: {
          assignmentId: "demo-project-written-assignment-teammate",
          responsibility: "member",
        },
      },
      0,
    ),
    activity(
      {
        id: "demo-activity-task-created",
        projectId: "demo-project-written",
        type: "task.created",
        details: {
          taskId: "demo-task-progress",
          taskTitle: "Preparar primera versión del escrito",
        },
      },
      1,
    ),
    activity(
      {
        id: "demo-activity-task-assigned",
        projectId: "demo-project-written",
        type: "task_assignment.added",
        subjectUserId: teammate.id,
        subjectNameSnapshot: teammate.name,
        details: {
          taskId: "demo-task-progress",
          taskTitle: "Preparar primera versión del escrito",
        },
      },
      2,
    ),
    activity(
      {
        id: "demo-activity-task-status",
        projectId: "demo-project-written",
        type: "task.status_changed",
        details: {
          taskId: "demo-task-progress",
          taskTitle: "Preparar primera versión del escrito",
          previousStatus: "pending",
          newStatus: "in_progress",
        },
      },
      3,
    ),
  ];

  const cases: DemoSeedData["cases"] = [
    {
      id: "demo-case-bbva",
      organizationId: "demo-organization",
      clientId: "demo-client-company",
      identification: "IR 2000 - DCA Principal",
      type: "judicial",
      subtype: "dca",
      stage: "judicial_first_instance",
      entity: "judiciary",
      docketNumber: "08549-2021-0-1801-JR-CA-20",
      tax: "IR",
      periodKind: "year",
      periodStart: "2000-01-01",
      periodEnd: "2000-12-01",
      amount: "15500000.00",
      currency: "PEN",
      claimantType: "client",
      disputedMatter: "Gastos comunes no deducibles e intereses en suspenso.",
      challengedResolution: "07532-9-2021",
      status: "in_progress",
      result: null,
      createdByUserId: owner.id,
      createdAt,
      updatedAt: instant(baseDate, -1),
    },
    {
      id: "demo-case-refund",
      organizationId: "demo-organization",
      clientId: "demo-client-person",
      identification: "Solicitud de devolución 2024",
      type: "administrative",
      subtype: "refund",
      stage: "administrative_refund",
      entity: "sunat",
      tax: "IGV",
      periodKind: "month_range",
      periodStart: "2024-01-01",
      periodEnd: "2024-06-01",
      amount: "85000.00",
      currency: "USD",
      claimantType: null,
      status: "concluded",
      result: "founded",
      createdByUserId: owner.id,
      createdAt,
      updatedAt: instant(baseDate, -2),
    },
  ];
  const caseAssignmentsData: DemoSeedData["caseAssignments"] = [
    {
      id: "demo-case-assignment-owner",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      userId: owner.id,
      userNameSnapshot: owner.name,
      userEmailSnapshot: owner.email,
      responsibility: "member",
      assignedByUserId: owner.id,
      assignedByNameSnapshot: owner.name,
      assignedAt: createdAt,
    },
    {
      id: "demo-case-assignment-teammate",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      userId: teammate.id,
      userNameSnapshot: teammate.name,
      userEmailSnapshot: teammate.email,
      responsibility: "member",
      assignedByUserId: owner.id,
      assignedByNameSnapshot: owner.name,
      assignedAt: createdAt,
    },
    {
      id: "demo-case-follower-teammate",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      userId: teammate.id,
      userNameSnapshot: teammate.name,
      userEmailSnapshot: teammate.email,
      responsibility: "follower",
      assignedByUserId: owner.id,
      assignedByNameSnapshot: owner.name,
      assignedAt: createdAt,
    },
  ];
  const caseActivityData: DemoSeedData["caseActivities"] = cases.map(
    (record, index) => ({
      id: `demo-case-activity-${index + 1}`,
      organizationId: "demo-organization",
      caseId: record.id,
      type: "case.created",
      actorUserId: owner.id,
      actorNameSnapshot: owner.name,
      details: { identification: record.identification },
      createdAt: instant(baseDate, -2 + index, 13),
    }),
  );
  const caseUpdateData: DemoSeedData["caseUpdates"] = [
    {
      id: "demo-case-update-appeal",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      date: calendarDate(baseDate, -7),
      description: "Se presentó el recurso de apelación del cliente.",
      kind: "background",
      createdByUserId: owner.id,
      createdAt: instant(baseDate, -7, 16),
      updatedAt: instant(baseDate, -7, 16),
    },
    {
      id: "demo-case-update-ruling",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      date: calendarDate(baseDate, -2),
      description: "Se notificó la sentencia de primera instancia.",
      kind: "update",
      createdByUserId: teammate.id,
      createdAt: instant(baseDate, -2, 11),
      updatedAt: instant(baseDate, -2, 11),
    },
  ];
  const caseActionData: DemoSeedData["caseActions"] = [
    {
      id: "demo-case-action-brief",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      description: "Preparar el escrito pendiente para revisión.",
      assigneeUserId: teammate.id,
      assigneeNameSnapshot: teammate.name,
      createdByUserId: owner.id,
      status: "pending",
      createdAt: instant(baseDate, -1, 10),
      updatedAt: instant(baseDate, -1, 10),
    },
  ];
  const caseEventData: DemoSeedData["caseEvents"] = [
    {
      id: "demo-case-event-oral-argument",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      title: "Informe oral ante la Sala",
      type: "oral_argument",
      date: calendarDate(baseDate, 3),
      description: "Fecha de demostración para el seguimiento del caso.",
      createdByUserId: owner.id,
      createdAt: instant(baseDate, -1, 12),
      updatedAt: instant(baseDate, -1, 12),
    },
    {
      id: "demo-case-event-interview",
      organizationId: "demo-organization",
      caseId: "demo-case-bbva",
      title: "Entrevista con el cliente",
      type: "interview",
      date: calendarDate(baseDate, 6),
      description: "Reunión de preparación y revisión de antecedentes.",
      createdByUserId: owner.id,
      createdAt: instant(baseDate, -1, 12),
      updatedAt: instant(baseDate, -1, 12),
    },
    {
      id: "demo-case-event-other",
      organizationId: "demo-organization",
      caseId: "demo-case-refund",
      title: "Hito de seguimiento",
      type: "other",
      date: calendarDate(baseDate, 9),
      description: "Otro evento relevante para el seguimiento del caso.",
      createdByUserId: teammate.id,
      createdAt: instant(baseDate, -1, 12),
      updatedAt: instant(baseDate, -1, 12),
    },
  ];
  caseActivityData.push(
    ...caseUpdateData.map((record, index) => ({
      id: `demo-case-update-activity-${index + 1}`,
      organizationId: "demo-organization",
      caseId: record.caseId,
      type: "case.update_created",
      actorUserId: record.createdByUserId,
      actorNameSnapshot: index === 0 ? owner.name : teammate.name,
      details: {
        updateId: record.id,
        date: record.date,
        description: record.description,
        kind: "update",
      },
      createdAt: record.createdAt,
    })),
  );
  caseActivityData.push({
    id: "demo-case-updates-background-activity-1",
    organizationId: "demo-organization",
    caseId: "demo-case-bbva",
    type: "case.updates_moved_to_background",
    actorUserId: owner.id,
    actorNameSnapshot: owner.name,
    details: { count: "1" },
    createdAt: instant(baseDate, -6, 10),
  });
  caseActivityData.push({
    id: "demo-case-event-activity-1",
    organizationId: "demo-organization",
    caseId: "demo-case-bbva",
    type: "case.event_created",
    actorUserId: owner.id,
    actorNameSnapshot: owner.name,
    details: {
      eventId: "demo-case-event-oral-argument",
      title: "Informe oral ante la Sala",
      type: "oral_argument",
      date: calendarDate(baseDate, 3),
      description: "Fecha de demostración para el seguimiento del caso.",
    },
    createdAt: instant(baseDate, -1, 12),
  });
  caseActivityData.push({
    id: "demo-case-action-activity-1",
    organizationId: "demo-organization",
    caseId: "demo-case-bbva",
    type: "case.action_created",
    actorUserId: owner.id,
    actorNameSnapshot: owner.name,
    subjectUserId: teammate.id,
    subjectNameSnapshot: teammate.name,
    details: {
      actionId: "demo-case-action-brief",
      description: "Preparar el escrito pendiente para revisión.",
      assigneeUserId: teammate.id,
      assigneeName: teammate.name,
    },
    createdAt: instant(baseDate, -1, 10),
  });

  return {
    users: [owner, teammate],
    credentialAccount: {
      id: "demo-account-credential",
      accountId: owner.id,
      providerId: "credential",
      userId: owner.id,
      createdAt,
      updatedAt: createdAt,
    },
    organizations: [
      {
        id: "demo-organization",
        name: "Estudio Orbit Demo",
        slug: "orbit-demo-local",
        createdAt,
        timeZone: "America/Lima",
      },
    ],
    members: [
      {
        id: "demo-member-owner",
        organizationId: "demo-organization",
        userId: owner.id,
        role: "owner",
        createdAt,
      },
      {
        id: "demo-member-teammate",
        organizationId: "demo-organization",
        userId: teammate.id,
        role: "member",
        createdAt,
      },
    ],
    clients: [
      {
        id: "demo-client-company",
        organizationId: "demo-organization",
        type: "company",
        name: "Constructora Andina S.A.C.",
        documentType: "RUC",
        documentNumber: "20123456789",
        email: "legal@constructora-andina.test",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "demo-client-person",
        organizationId: "demo-organization",
        type: "person",
        name: "María Torres",
        documentType: "DNI",
        documentNumber: "12345678",
        email: "maria.torres@example.test",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    projects,
    projectEvents,
    stages,
    tasks,
    projectAssignments,
    taskAssignments,
    activities,
    cases,
    caseAssignments: caseAssignmentsData,
    caseActivities: caseActivityData,
    caseUpdates: caseUpdateData,
    caseActions: caseActionData,
    caseEvents: caseEventData,
  };
}
