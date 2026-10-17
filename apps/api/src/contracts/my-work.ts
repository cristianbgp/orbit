import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";
import {
  AvatarColorSchema,
  NullableStudioMemberPositionSchema,
  UserAliasSchema,
} from "./identity";
import { ProjectTaskStatusSchema } from "./project-tasks";

const CalendarDateSchema = z.iso.date();

function queryArray<T extends z.ZodType>(schema: T, maximum: number) {
  return z.preprocess(
    (value) =>
      value === undefined ? [] : Array.isArray(value) ? value : [value],
    z.array(schema).max(maximum),
  );
}

const MyWorkQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).optional(),
    projectId: queryArray(z.string().trim().min(1), 100),
    status: queryArray(ProjectTaskStatusSchema, 4),
    dateFrom: CalendarDateSchema.optional(),
    dateTo: CalendarDateSchema.optional(),
    includeCompleted: z.stringbool().default(false),
  })
  .refine(
    (input) =>
      !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo,
    {
      path: ["dateTo"],
      message: "The end date must not precede the start date.",
    },
  );

const MyCaseActionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional(),
  clientId: queryArray(z.string().trim().min(1), 100),
  caseId: queryArray(z.string().trim().min(1), 100),
  type: queryArray(
    z.enum(["administrative", "judicial", "constitutional", "other"]),
    4,
  ),
  includeCompleted: z.stringbool().default(false),
});

const PaginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

const ResponsibleSchema = z.object({
  assignmentId: z.string(),
  userId: z.string().nullable(),
  userName: z.string(),
  userEmail: z.string(),
  userAlias: UserAliasSchema,
  userAvatarColor: AvatarColorSchema.nullable(),
  userPosition: NullableStudioMemberPositionSchema,
  activeStudioMember: z.boolean(),
  assignedAt: z.iso.datetime(),
});

export const MyWorkTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: ProjectTaskStatusSchema,
    plannedStartDate: CalendarDateSchema.nullable(),
    internalDueDate: CalendarDateSchema.nullable(),
    updatedAt: z.iso.datetime(),
    group: z.enum([
      "overdue",
      "today",
      "this_week",
      "future",
      "undated",
      "completed",
    ]),
    project: z.object({
      id: z.string(),
      name: z.string(),
      client: z.object({ id: z.string(), name: z.string() }),
    }),
    stage: z.object({
      id: z.string(),
      name: z.string(),
      position: z.number().int(),
    }),
    responsibles: z.array(ResponsibleSchema),
  })
  .openapi("MyWorkTask");

const AssignedResponseSchema = z
  .object({
    today: CalendarDateSchema,
    tasks: z.array(MyWorkTaskSchema),
    pagination: PaginationSchema,
  })
  .openapi("MyAssignedTasksResponse");

const SupervisedProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    client: z.object({ id: z.string(), name: z.string() }),
    startDate: CalendarDateSchema,
    endDate: CalendarDateSchema,
    counts: z.object({
      pending: z.number().int().min(0),
      inProgress: z.number().int().min(0),
      blocked: z.number().int().min(0),
      completed: z.number().int().min(0),
      unassigned: z.number().int().min(0),
      total: z.number().int().min(0),
    }),
    attentionTasks: z.array(MyWorkTaskSchema).max(5),
  })
  .openapi("MySupervisedProject");

const SupervisionResponseSchema = z
  .object({
    today: CalendarDateSchema,
    projects: z.array(SupervisedProjectSchema),
    pagination: PaginationSchema,
  })
  .openapi("MySupervisionResponse");

const MyCaseActionSchema = z
  .object({
    id: z.string(),
    description: z.string(),
    status: z.enum(["pending", "completed"]),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    case: z.object({
      id: z.string(),
      identification: z.string(),
      type: z
        .enum(["administrative", "judicial", "constitutional", "other"])
        .nullable(),
      client: z.object({ id: z.string(), name: z.string() }),
    }),
  })
  .openapi("MyCaseAction");

const MyCaseActionsResponseSchema = z
  .object({
    actions: z.array(MyCaseActionSchema),
    pagination: PaginationSchema,
  })
  .openapi("MyCaseActionsResponse");

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
    description: "An active organization is required.",
    content: {
      "application/json": { schema: OrganizationRequiredErrorSchema },
    },
  },
} as const;

export const listMyAssignedTasksRoute = createRoute({
  method: "get",
  path: "/api/my-work/tasks",
  operationId: "listMyAssignedTasks",
  tags: ["My work"],
  security: [{ sessionCookie: [] }],
  request: { query: MyWorkQuerySchema },
  responses: {
    200: {
      description: "Tasks actively assigned to the current user.",
      content: { "application/json": { schema: AssignedResponseSchema } },
    },
    400: {
      description: "Invalid filters.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

export const listMySupervisionRoute = createRoute({
  method: "get",
  path: "/api/my-work/supervision",
  operationId: "listMySupervision",
  tags: ["My work"],
  security: [{ sessionCookie: [] }],
  request: { query: MyWorkQuerySchema },
  responses: {
    200: {
      description: "Active projects supervised by the current user.",
      content: { "application/json": { schema: SupervisionResponseSchema } },
    },
    400: {
      description: "Invalid filters.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

export const listMyCaseActionsRoute = createRoute({
  method: "get",
  path: "/api/my-work/case-actions",
  operationId: "listMyCaseActions",
  tags: ["My work"],
  security: [{ sessionCookie: [] }],
  request: { query: MyCaseActionsQuerySchema },
  responses: {
    200: {
      description: "Case actions assigned to the current user.",
      content: { "application/json": { schema: MyCaseActionsResponseSchema } },
    },
    400: {
      description: "Invalid filters.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});
