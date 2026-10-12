import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";
import { NullableStudioMemberPositionSchema } from "./identity";

export const ProjectTypeSchema = z
  .enum(["written_submission", "consultation", "oral_argument", "other"])
  .openapi("ProjectType");

export const ProjectStatusSchema = z
  .enum(["draft", "active", "completed"])
  .openapi("ProjectStatus");

export const ProjectViewSchema = z
  .enum(["current", "completed", "archived"])
  .openapi("ProjectView");

export const ProjectOrderBySchema = z
  .enum(["endDate", "startDate", "name", "archivedAt"])
  .openapi("ProjectOrderBy");

export const ProjectOrderSchema = z
  .enum(["asc", "desc"])
  .openapi("ProjectOrder");

const CalendarDateSchema = z.iso.date();
const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional();

function optionalQueryArray<T extends z.ZodType>(schema: T, maximum: number) {
  return z.preprocess(
    (value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    z.array(schema).max(maximum).optional(),
  );
}

const ProjectBaseInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientId: z.string().trim().min(1),
  type: ProjectTypeSchema,
  status: ProjectStatusSchema,
  startDate: CalendarDateSchema,
  endDate: CalendarDateSchema,
  internalReference: optionalText(80),
  description: optionalText(2_000),
});

function datesAreOrdered(input: { startDate?: string; endDate?: string }) {
  if (!input.startDate || !input.endDate) return true;
  return input.startDate <= input.endDate;
}

const InitialLegalEventSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  date: CalendarDateSchema,
  description: optionalText(2_000),
});

const InitialProjectAssignmentSchema = z.object({
  userId: z.string().trim().min(1),
  responsibility: z.enum(["member", "responsible"]),
});

const InitialProjectAssignmentsSchema = z
  .array(InitialProjectAssignmentSchema)
  .max(100)
  .superRefine((assignments, context) => {
    const userIds = new Set<string>();
    assignments.forEach((assignment, index) => {
      if (userIds.has(assignment.userId)) {
        context.addIssue({
          code: "custom",
          message: "Cada integrante solo puede añadirse una vez.",
          path: [index, "userId"],
        });
      }
      userIds.add(assignment.userId);
    });
  });

export const ProjectInputSchema = ProjectBaseInputSchema.extend({
  status: ProjectStatusSchema.default("draft"),
  initialLegalEvent: InitialLegalEventSchema.optional(),
  initialLegalEvents: z.array(InitialLegalEventSchema).max(25).optional(),
  initialAssignments: InitialProjectAssignmentsSchema.optional(),
})
  .refine(datesAreOrdered, {
    message: "Revisa el orden de las fechas del proyecto.",
    path: ["endDate"],
  })
  .superRefine((input, context) => {
    if (input.initialLegalEvent && input.initialLegalEvents) {
      context.addIssue({
        code: "custom",
        message: "Usa solo una forma para registrar los eventos iniciales.",
        path: ["initialLegalEvents"],
      });
    }
    if (
      input.initialLegalEvent &&
      input.initialLegalEvent.date < input.startDate
    ) {
      context.addIssue({
        code: "custom",
        message: "El evento no puede ser anterior al inicio del proyecto.",
        path: ["initialLegalEvent", "date"],
      });
    }
    input.initialLegalEvents?.forEach((event, index) => {
      if (event.date < input.startDate) {
        context.addIssue({
          code: "custom",
          message: "El evento no puede ser anterior al inicio del proyecto.",
          path: ["initialLegalEvents", index, "date"],
        });
      }
    });
  })
  .openapi("ProjectInput");

export const ProjectUpdateSchema = ProjectBaseInputSchema.partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one project field is required",
  })
  .openapi("ProjectUpdate");

const ProjectClientSchema = z
  .object({ id: z.string(), name: z.string() })
  .openapi("ProjectClient");

export const ProjectSchema = z
  .object({
    id: z.string(),
    client: ProjectClientSchema,
    name: z.string(),
    type: ProjectTypeSchema,
    status: ProjectStatusSchema,
    startDate: CalendarDateSchema,
    endDate: CalendarDateSchema,
    internalReference: z.string().nullable(),
    description: z.string().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Project");

const ProjectTeamMemberSummarySchema = z
  .object({
    userId: z.string(),
    fullName: z.string(),
    alias: z.string(),
    avatarColor: z.string().nullable(),
    responsibility: z.enum(["responsible", "member"]),
    position: NullableStudioMemberPositionSchema,
  })
  .openapi("ProjectTeamMemberSummary");

const ProjectTeamSummarySchema = z
  .object({
    members: z.array(ProjectTeamMemberSummarySchema),
    total: z.number().int().min(0),
  })
  .openapi("ProjectTeamSummary");

const ProjectListItemSchema = ProjectSchema.extend({
  team: ProjectTeamSummarySchema,
}).openapi("ProjectListItem");

const ProjectPaginationSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .openapi("ProjectPagination");

export const ProjectResponseSchema = z
  .object({ project: ProjectSchema })
  .openapi("ProjectResponse");

const ProjectListResponseSchema = z
  .object({
    projects: z.array(ProjectListItemSchema),
    pagination: ProjectPaginationSchema,
  })
  .openapi("ProjectListResponse");

const ProjectClientGroupSchema = z
  .object({
    client: ProjectClientSchema,
    projects: z.array(ProjectListItemSchema),
  })
  .openapi("ProjectClientGroup");

const ProjectsGroupedByClientResponseSchema = z
  .object({
    groups: z.array(ProjectClientGroupSchema),
    pagination: ProjectPaginationSchema,
    projectTotal: z.number().int().min(0),
  })
  .openapi("ProjectsGroupedByClientResponse");

const ProjectNotFoundErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("NOT_FOUND"),
      message: z.literal("Proyecto no encontrado."),
    }),
  })
  .openapi("ProjectNotFoundError");

export const ProjectArchivedErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("PROJECT_ARCHIVED"),
      message: z.literal(
        "El proyecto está archivado. Restáuralo para realizar cambios.",
      ),
    }),
  })
  .openapi("ProjectArchivedError");

export const ProjectArchiveConflictErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("PROJECT_ARCHIVE_CONFLICT"),
      message: z.string(),
    }),
  })
  .openapi("ProjectArchiveConflictError");

const ClientUnavailableErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("NOT_FOUND"),
      message: z.literal("Cliente no disponible."),
    }),
  })
  .openapi("ClientUnavailableError");

const InvalidProjectDatesErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("VALIDATION_ERROR"),
      message: z.string(),
    }),
  })
  .openapi("InvalidProjectDatesError");

const accessErrors = {
  ...rateLimitedErrorResponse,
  401: {
    description: "Authentication is required.",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  403: {
    description: "The user is not a member of the active organization.",
    content: { "application/json": { schema: ForbiddenErrorSchema } },
  },
} as const;

const authErrors = {
  ...accessErrors,
  409: {
    description: "An active organization is required.",
    content: {
      "application/json": { schema: OrganizationRequiredErrorSchema },
    },
  },
} as const;

export const listProjectsRoute = createRoute({
  method: "get",
  path: "/api/projects",
  operationId: "listProjects",
  tags: ["Projects"],
  security: [{ sessionCookie: [] }],
  request: {
    query: z.object({
      search: z.string().trim().max(160).optional(),
      type: optionalQueryArray(ProjectTypeSchema, 4),
      status: optionalQueryArray(ProjectStatusSchema, 4),
      client: optionalQueryArray(z.string().trim().min(1), 100),
      member: optionalQueryArray(z.string().trim().min(1), 100),
      view: ProjectViewSchema.optional(),
      orderBy: ProjectOrderBySchema.optional(),
      order: ProjectOrderSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
  },
  responses: {
    200: {
      description: "Projects in the active organization.",
      content: { "application/json": { schema: ProjectListResponseSchema } },
    },
    400: {
      description: "The query is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

export const listProjectsGroupedByClientRoute = createRoute({
  method: "get",
  path: "/api/projects/grouped-by-client",
  operationId: "listProjectsGroupedByClient",
  tags: ["Projects"],
  security: [{ sessionCookie: [] }],
  request: {
    query: z.object({
      search: z.string().trim().max(160).optional(),
      type: optionalQueryArray(ProjectTypeSchema, 4),
      status: optionalQueryArray(ProjectStatusSchema, 4),
      client: optionalQueryArray(z.string().trim().min(1), 100),
      member: optionalQueryArray(z.string().trim().min(1), 100),
      view: ProjectViewSchema.optional(),
      orderBy: ProjectOrderBySchema.optional(),
      order: ProjectOrderSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }),
  },
  responses: {
    200: {
      description: "Matching projects grouped into complete client portfolios.",
      content: {
        "application/json": { schema: ProjectsGroupedByClientResponseSchema },
      },
    },
    400: {
      description: "The query is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

export const createProjectRoute = createRoute({
  method: "post",
  path: "/api/projects",
  operationId: "createProject",
  tags: ["Projects"],
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ProjectInputSchema } },
    },
  },
  responses: {
    201: {
      description: "The created project.",
      content: { "application/json": { schema: ProjectResponseSchema } },
    },
    400: {
      description: "The project input or date order is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    404: {
      description: "The selected client is unavailable.",
      content: {
        "application/json": { schema: ClientUnavailableErrorSchema },
      },
    },
    ...authErrors,
  },
});

const projectParams = z.object({ projectId: z.string().min(1) });

export const getProjectRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}",
  operationId: "getProject",
  tags: ["Projects"],
  security: [{ sessionCookie: [] }],
  request: { params: projectParams },
  responses: {
    200: {
      description: "One project in the active organization.",
      content: { "application/json": { schema: ProjectResponseSchema } },
    },
    404: {
      description: "The project does not exist in the active organization.",
      content: {
        "application/json": { schema: ProjectNotFoundErrorSchema },
      },
    },
    ...authErrors,
  },
});

const archivedWriteConflictResponse = {
  description: "An active organization is required or the project is archived.",
  content: {
    "application/json": {
      schema: z.union([
        OrganizationRequiredErrorSchema,
        ProjectArchivedErrorSchema,
      ]),
    },
  },
} as const;

export const updateProjectRoute = createRoute({
  method: "patch",
  path: "/api/projects/{projectId}",
  operationId: "updateProject",
  tags: ["Projects"],
  security: [{ sessionCookie: [] }],
  request: {
    params: projectParams,
    body: {
      required: true,
      content: { "application/json": { schema: ProjectUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated project.",
      content: { "application/json": { schema: ProjectResponseSchema } },
    },
    400: {
      description: "The project update creates invalid date order.",
      content: {
        "application/json": { schema: InvalidProjectDatesErrorSchema },
      },
    },
    404: {
      description: "The project or selected client is unavailable.",
      content: {
        "application/json": {
          schema: z.union([
            ProjectNotFoundErrorSchema,
            ClientUnavailableErrorSchema,
          ]),
        },
      },
    },
    409: archivedWriteConflictResponse,
    ...accessErrors,
  },
});

const archiveConflictResponse = {
  description: "The project archive state conflicts with the request.",
  content: {
    "application/json": {
      schema: z.union([
        OrganizationRequiredErrorSchema,
        ProjectArchiveConflictErrorSchema,
      ]),
    },
  },
} as const;

export const archiveProjectRoute = createRoute({
  method: "post",
  path: "/api/projects/{projectId}/archive",
  operationId: "archiveProject",
  tags: ["Projects"],
  security: [{ sessionCookie: [] }],
  request: { params: projectParams },
  responses: {
    200: {
      description: "The archived project.",
      content: { "application/json": { schema: ProjectResponseSchema } },
    },
    404: {
      description: "The project does not exist in the active organization.",
      content: { "application/json": { schema: ProjectNotFoundErrorSchema } },
    },
    409: archiveConflictResponse,
    ...accessErrors,
  },
});

export const restoreProjectRoute = createRoute({
  method: "post",
  path: "/api/projects/{projectId}/restore",
  operationId: "restoreProject",
  tags: ["Projects"],
  security: [{ sessionCookie: [] }],
  request: { params: projectParams },
  responses: {
    200: {
      description: "The restored project.",
      content: { "application/json": { schema: ProjectResponseSchema } },
    },
    404: {
      description: "The project does not exist in the active organization.",
      content: { "application/json": { schema: ProjectNotFoundErrorSchema } },
    },
    409: archiveConflictResponse,
    ...accessErrors,
  },
});
