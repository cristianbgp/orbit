import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";
import { ProjectArchivedErrorSchema } from "./projects";

const CalendarDateSchema = z.iso.date();
const ProjectEventTypeSchema = z
  .enum(["legal", "meeting", "other"])
  .openapi("ProjectEventType");
const LegalEventMutationTypeSchema = z.literal("legal");

const ProjectEventSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    type: ProjectEventTypeSchema,
    date: CalendarDateSchema,
    description: z.string().nullable(),
    createdByUserId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("ProjectEvent");

const ProjectEventInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    type: LegalEventMutationTypeSchema,
    date: CalendarDateSchema,
    description: z.string().trim().max(2_000).nullable().optional(),
  })
  .openapi("ProjectEventInput");

const ProjectEventUpdateSchema = ProjectEventInputSchema.partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one event field is required",
  })
  .openapi("ProjectEventUpdate");

const params = z.object({
  projectId: z.string().min(1),
  eventId: z.string().min(1).optional(),
});

const errors = {
  ...rateLimitedErrorResponse,
  400: {
    description: "The event input or date is invalid.",
    content: { "application/json": { schema: ValidationErrorSchema } },
  },
  401: {
    description: "Authentication is required.",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  403: {
    description: "Studio membership is required.",
    content: { "application/json": { schema: ForbiddenErrorSchema } },
  },
  404: {
    description: "The project or event was not found.",
    content: {
      "application/json": {
        schema: z.object({
          error: z.object({
            code: z.literal("NOT_FOUND"),
            message: z.string(),
          }),
        }),
      },
    },
  },
  409: {
    description: "An organization is required or the project is archived.",
    content: {
      "application/json": {
        schema: z.union([
          OrganizationRequiredErrorSchema,
          ProjectArchivedErrorSchema,
        ]),
      },
    },
  },
} as const;

export const listProjectEventsRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/events",
  operationId: "listProjectEvents",
  tags: ["Project events"],
  security: [{ sessionCookie: [] }],
  request: {
    params: params.pick({ projectId: true }),
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
  },
  responses: {
    200: {
      description: "Paginated project events.",
      content: {
        "application/json": {
          schema: z.object({
            events: z.array(ProjectEventSchema),
            pagination: z.object({
              page: z.number().int(),
              pageSize: z.number().int(),
              total: z.number().int(),
              totalPages: z.number().int(),
            }),
          }),
        },
      },
    },
    ...errors,
  },
});

export const createProjectEventRoute = createRoute({
  method: "post",
  path: "/api/projects/{projectId}/events",
  operationId: "createProjectEvent",
  tags: ["Project events"],
  security: [{ sessionCookie: [] }],
  request: {
    params: params.pick({ projectId: true }),
    body: {
      required: true,
      content: { "application/json": { schema: ProjectEventInputSchema } },
    },
  },
  responses: {
    201: {
      description: "The created event.",
      content: {
        "application/json": {
          schema: z.object({ event: ProjectEventSchema }),
        },
      },
    },
    ...errors,
  },
});

export const updateProjectEventRoute = createRoute({
  method: "patch",
  path: "/api/projects/{projectId}/events/{eventId}",
  operationId: "updateProjectEvent",
  tags: ["Project events"],
  security: [{ sessionCookie: [] }],
  request: {
    params: params.required(),
    body: {
      required: true,
      content: { "application/json": { schema: ProjectEventUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated event.",
      content: {
        "application/json": { schema: z.object({ event: ProjectEventSchema }) },
      },
    },
    ...errors,
  },
});

export const deleteProjectEventRoute = createRoute({
  method: "delete",
  path: "/api/projects/{projectId}/events/{eventId}",
  operationId: "deleteProjectEvent",
  tags: ["Project events"],
  security: [{ sessionCookie: [] }],
  request: { params: params.required() },
  responses: {
    204: { description: "The event was deleted." },
    ...errors,
  },
});
