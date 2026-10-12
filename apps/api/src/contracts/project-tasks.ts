import { createRoute, z } from "@hono/zod-openapi";

import {
  NullableAvatarColorSchema,
  NullableStudioMemberPositionSchema,
  UserAliasSchema,
} from "./identity";

import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";

export const ProjectTaskStatusSchema = z
  .enum(["pending", "in_progress", "blocked", "completed"])
  .openapi("ProjectTaskStatus");

const CalendarDateSchema = z.iso.date();

export const ProjectTaskInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    stageId: z.string().trim().min(1),
    description: z.string().trim().max(2_000).nullable().optional(),
    status: ProjectTaskStatusSchema.default("pending"),
    plannedStartDate: CalendarDateSchema.nullable().optional(),
    internalDueDate: CalendarDateSchema.nullable().optional(),
    responsibleUserIds: z.array(z.string().trim().min(1)).max(100).default([]),
  })
  .superRefine((input, context) => {
    const hasAutomaticStart =
      input.status === "in_progress" || input.status === "completed";
    if (
      input.internalDueDate &&
      !input.plannedStartDate &&
      !hasAutomaticStart
    ) {
      context.addIssue({
        code: "custom",
        path: ["plannedStartDate"],
        message: "Selecciona un inicio planificado para usar una fecha límite.",
      });
    }
  })
  .openapi("ProjectTaskInput");

export const ProjectTaskUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    stageId: z.string().trim().min(1).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    status: ProjectTaskStatusSchema.optional(),
    plannedStartDate: CalendarDateSchema.nullable().optional(),
    internalDueDate: CalendarDateSchema.nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one task field is required",
  })
  .superRefine((input, context) => {
    const hasAutomaticStart =
      input.status === "in_progress" || input.status === "completed";
    if (
      input.internalDueDate &&
      input.plannedStartDate === null &&
      !hasAutomaticStart
    ) {
      context.addIssue({
        code: "custom",
        path: ["plannedStartDate"],
        message: "Selecciona un inicio planificado para usar una fecha límite.",
      });
    }
  })
  .openapi("ProjectTaskUpdate");

export const ProjectTaskResponsiblesInputSchema = z
  .object({
    responsibleUserIds: z.array(z.string().trim().min(1)).max(100),
  })
  .openapi("ProjectTaskResponsiblesInput");

const TaskResponsibleSchema = z
  .object({
    assignmentId: z.string(),
    userId: z.string().nullable(),
    userName: z.string(),
    userEmail: z.string(),
    userAlias: UserAliasSchema,
    userAvatarColor: NullableAvatarColorSchema,
    userPosition: NullableStudioMemberPositionSchema,
    activeStudioMember: z.boolean(),
    assignedAt: z.iso.datetime(),
  })
  .openapi("TaskResponsible");

export const ProjectTaskSchema = z
  .object({
    id: z.string(),
    stage: z.object({
      id: z.string(),
      name: z.string(),
      position: z.number().int(),
    }),
    title: z.string(),
    description: z.string().nullable(),
    status: ProjectTaskStatusSchema,
    plannedStartDate: CalendarDateSchema.nullable(),
    internalDueDate: CalendarDateSchema.nullable(),
    position: z.number().int(),
    archivedAt: z.iso.datetime().nullable(),
    responsibles: z.array(TaskResponsibleSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("ProjectTask");

const ProjectTaskResponseSchema = z
  .object({ task: ProjectTaskSchema })
  .openapi("ProjectTaskResponse");

const ProjectTaskListResponseSchema = z
  .object({
    tasks: z.array(ProjectTaskSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
    }),
  })
  .openapi("ProjectTaskListResponse");

const ProjectTaskCalendarContextFields = {
  id: z.string(),
  title: z.string(),
  status: ProjectTaskStatusSchema,
  internalDueDate: CalendarDateSchema.nullable(),
  position: z.number().int(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    startDate: CalendarDateSchema,
    client: z.object({ id: z.string(), name: z.string() }),
  }),
  stage: z.object({
    id: z.string(),
    name: z.string(),
    position: z.number().int(),
  }),
  responsibles: z.array(TaskResponsibleSchema),
};

const ProjectTaskCalendarContextSchema = z
  .object({
    ...ProjectTaskCalendarContextFields,
    plannedStartDate: CalendarDateSchema,
  })
  .openapi("ProjectTaskCalendarContext");

const UndatedProjectTaskContextSchema = z
  .object({
    ...ProjectTaskCalendarContextFields,
    plannedStartDate: z.null(),
  })
  .openapi("UndatedProjectTaskContext");

const ProjectTaskCalendarMarkerSchema = z
  .object({
    projectId: z.string(),
    projectName: z.string(),
    clientName: z.string(),
    kind: z.enum(["project_start", "project_end", "project_event"]),
    date: CalendarDateSchema,
    eventId: z.string().optional(),
    eventTitle: z.string().optional(),
    eventType: z.enum(["legal", "meeting", "other"]).optional(),
  })
  .openapi("ProjectTaskCalendarMarker");

const ProjectTaskCalendarResponseSchema = z
  .object({
    tasks: z.array(ProjectTaskCalendarContextSchema),
    markers: z.array(ProjectTaskCalendarMarkerSchema),
    undatedTaskCount: z.number().int().min(0),
    truncated: z.boolean(),
  })
  .openapi("ProjectTaskCalendarResponse");

const UndatedProjectTaskListResponseSchema = z
  .object({
    tasks: z.array(UndatedProjectTaskContextSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
    }),
  })
  .openapi("UndatedProjectTaskListResponse");

const TaskServiceErrorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        "FORBIDDEN",
        "NOT_FOUND",
        "VALIDATION_ERROR",
        "CONFLICT",
        "PROJECT_ARCHIVED",
      ]),
      message: z.string(),
    }),
  })
  .openapi("ProjectTaskServiceError");

const authErrors = {
  ...rateLimitedErrorResponse,
  401: {
    description: "Authentication is required.",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  403: {
    description: "The user is not a member of the active organization.",
    content: { "application/json": { schema: ForbiddenErrorSchema } },
  },
  409: {
    description: "The active organization or task state changed.",
    content: {
      "application/json": {
        schema: z.union([
          OrganizationRequiredErrorSchema,
          TaskServiceErrorSchema,
        ]),
      },
    },
  },
} as const;

const taskErrors = {
  400: {
    description: "The task input is invalid.",
    content: {
      "application/json": {
        schema: z.union([ValidationErrorSchema, TaskServiceErrorSchema]),
      },
    },
  },
  404: {
    description:
      "The project, task, stage, or responsible member is unavailable.",
    content: { "application/json": { schema: TaskServiceErrorSchema } },
  },
  ...authErrors,
} as const;

const projectParams = z.object({ projectId: z.string().min(1) });
const taskParams = projectParams.extend({ taskId: z.string().min(1) });

function queryArray<T extends z.ZodType>(schema: T, maximum: number) {
  return z.preprocess(
    (value) =>
      value === undefined ? [] : Array.isArray(value) ? value : [value],
    z.array(schema).max(maximum),
  );
}

const CalendarFilterQuerySchema = z.object({
  projectIds: queryArray(z.string().trim().min(1), 100),
  responsibleUserIds: queryArray(z.string().trim().min(1), 100),
  statuses: queryArray(ProjectTaskStatusSchema, 4),
  search: z.string().trim().max(160).optional(),
  overdueOnly: z.stringbool().default(false),
});

const ProjectTaskCalendarQuerySchema = CalendarFilterQuerySchema.extend({
  from: CalendarDateSchema,
  to: CalendarDateSchema,
}).superRefine((input, context) => {
  if (input.from > input.to) {
    context.addIssue({
      code: "custom",
      message: "The calendar start must not be after its end.",
      path: ["to"],
    });
    return;
  }
  const dayMilliseconds = 24 * 60 * 60 * 1_000;
  const from = Date.parse(`${input.from}T00:00:00.000Z`);
  const to = Date.parse(`${input.to}T00:00:00.000Z`);
  if ((to - from) / dayMilliseconds > 41) {
    context.addIssue({
      code: "custom",
      message: "The calendar range cannot exceed 42 days.",
      path: ["to"],
    });
  }
});

export const listProjectTaskCalendarRoute = createRoute({
  method: "get",
  path: "/api/project-tasks/calendar",
  operationId: "listProjectTaskCalendar",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: { query: ProjectTaskCalendarQuerySchema },
  responses: {
    200: {
      description: "Studio tasks overlapping the selected calendar range.",
      content: {
        "application/json": { schema: ProjectTaskCalendarResponseSchema },
      },
    },
    400: {
      description: "The calendar query is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

export const listUndatedProjectTasksRoute = createRoute({
  method: "get",
  path: "/api/project-tasks/undated",
  operationId: "listUndatedProjectTasks",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: {
    query: CalendarFilterQuerySchema.extend({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
  },
  responses: {
    200: {
      description: "Paginated studio tasks without planned dates.",
      content: {
        "application/json": { schema: UndatedProjectTaskListResponseSchema },
      },
    },
    400: {
      description: "The undated task query is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

export const listProjectTasksRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/tasks",
  operationId: "listProjectTasks",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: {
    params: projectParams,
    query: z.object({
      view: z.enum(["active", "archived"]).default("active"),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      stageId: z.string().trim().min(1).optional(),
    }),
  },
  responses: {
    200: {
      description: "Tasks in the selected project view.",
      content: {
        "application/json": { schema: ProjectTaskListResponseSchema },
      },
    },
    ...taskErrors,
  },
});

const ProjectTaskScheduleStageTaskStatusCountsSchema = z
  .object({
    pending: z.number().int().min(0),
    inProgress: z.number().int().min(0),
    blocked: z.number().int().min(0),
    completed: z.number().int().min(0),
  })
  .openapi("ProjectTaskScheduleStageTaskStatusCounts");

const ProjectTaskScheduleTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: ProjectTaskStatusSchema,
    plannedStartDate: CalendarDateSchema.nullable(),
    internalDueDate: CalendarDateSchema.nullable(),
    position: z.number().int(),
  })
  .openapi("ProjectTaskScheduleTask");

const ProjectTaskScheduleStageSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    position: z.number().int(),
    startDate: CalendarDateSchema.nullable(),
    endDate: CalendarDateSchema.nullable(),
    scheduledTaskCount: z.number().int().min(0),
    taskStatusCounts: ProjectTaskScheduleStageTaskStatusCountsSchema,
    tasks: z.array(ProjectTaskScheduleTaskSchema),
    usesProjectStartFallback: z.boolean(),
  })
  .openapi("ProjectTaskScheduleStage");

const ProjectTaskScheduleResponseSchema = z
  .object({
    project: z.object({
      startDate: CalendarDateSchema,
      endDate: CalendarDateSchema,
      timeZone: z.string().min(1),
    }),
    events: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.enum(["legal", "meeting", "other"]),
        date: CalendarDateSchema,
      }),
    ),
    stages: z.array(ProjectTaskScheduleStageSchema),
  })
  .openapi("ProjectTaskScheduleResponse");

export const getProjectTaskScheduleRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/task-schedule",
  operationId: "getProjectTaskSchedule",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: { params: projectParams },
  responses: {
    200: {
      description: "Task-derived schedule for the selected project.",
      content: {
        "application/json": { schema: ProjectTaskScheduleResponseSchema },
      },
    },
    ...taskErrors,
  },
});

export const createProjectTaskRoute = createRoute({
  method: "post",
  path: "/api/projects/{projectId}/tasks",
  operationId: "createProjectTask",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: {
    params: projectParams,
    body: {
      required: true,
      content: { "application/json": { schema: ProjectTaskInputSchema } },
    },
  },
  responses: {
    201: {
      description: "The created project task.",
      content: { "application/json": { schema: ProjectTaskResponseSchema } },
    },
    ...taskErrors,
  },
});

export const getProjectTaskRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/tasks/{taskId}",
  operationId: "getProjectTask",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: { params: taskParams },
  responses: {
    200: {
      description: "The selected project task.",
      content: { "application/json": { schema: ProjectTaskResponseSchema } },
    },
    ...taskErrors,
  },
});

export const updateProjectTaskRoute = createRoute({
  method: "patch",
  path: "/api/projects/{projectId}/tasks/{taskId}",
  operationId: "updateProjectTask",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: {
    params: taskParams,
    body: {
      required: true,
      content: { "application/json": { schema: ProjectTaskUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated project task.",
      content: { "application/json": { schema: ProjectTaskResponseSchema } },
    },
    ...taskErrors,
  },
});

export const replaceProjectTaskResponsiblesRoute = createRoute({
  method: "put",
  path: "/api/projects/{projectId}/tasks/{taskId}/responsibles",
  operationId: "replaceProjectTaskResponsibles",
  tags: ["Project tasks"],
  security: [{ sessionCookie: [] }],
  request: {
    params: taskParams,
    body: {
      required: true,
      content: {
        "application/json": { schema: ProjectTaskResponsiblesInputSchema },
      },
    },
  },
  responses: {
    200: {
      description: "The task with its final responsible-member set.",
      content: { "application/json": { schema: ProjectTaskResponseSchema } },
    },
    ...taskErrors,
  },
});

function stateRoute(
  operationId: "archiveProjectTask" | "restoreProjectTask",
  action: "archive" | "restore",
) {
  return createRoute({
    method: "post",
    path: `/api/projects/{projectId}/tasks/{taskId}/${action}`,
    operationId,
    tags: ["Project tasks"],
    security: [{ sessionCookie: [] }],
    request: { params: taskParams },
    responses: {
      200: {
        description: `The ${action}d project task.`,
        content: { "application/json": { schema: ProjectTaskResponseSchema } },
      },
      ...taskErrors,
    },
  });
}

export const archiveProjectTaskRoute = stateRoute(
  "archiveProjectTask",
  "archive",
);
export const restoreProjectTaskRoute = stateRoute(
  "restoreProjectTask",
  "restore",
);
