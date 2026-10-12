import type { DashboardActivityPreview } from "@/lib/api/generated/models";

export const dashboardActivityFixture: DashboardActivityPreview[] = [
  {
    source: "project",
    case: null,
    id: "activity-1",
    type: "task.status_changed",
    actor: {
      userId: "user-1",
      alias: "AT",
      avatarColor: "#11182b",
      nameSnapshot: "Ana Torres",
      activeStudioMember: true,
      linkable: true,
    },
    subject: null,
    details: {
      taskId: "task-1",
      taskTitle: "Revisar antecedentes",
      newStatus: "in_progress",
    },
    createdAt: "2026-08-10T14:00:00.000Z",
    project: {
      id: "project-1",
      name: "Apelación Constructora",
      status: "completed",
      archivedAt: null,
    },
  },
  {
    source: "project",
    case: null,
    id: "activity-2",
    type: "project.archived",
    actor: {
      userId: null,
      alias: null,
      avatarColor: null,
      nameSnapshot: "Miembro retirado",
      activeStudioMember: false,
      linkable: false,
    },
    subject: null,
    details: {},
    createdAt: "2026-08-10T13:00:00.000Z",
    project: {
      id: "project-4",
      name: "Proyecto archivado",
      status: "active",
      archivedAt: "2026-08-10T13:00:00.000Z",
    },
  },
];
