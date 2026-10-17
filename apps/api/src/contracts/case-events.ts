import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  OrganizationRequiredErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
  rateLimitedErrorResponse,
} from "./common";
import { CaseStageSchema, CaseStatusSchema, CaseTypeSchema } from "./cases";

export const CaseEventTypeSchema = z
  .enum(["oral_argument", "interview", "other"])
  .openapi("CaseEventType");

export const CaseEventSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    type: CaseEventTypeSchema,
    date: z.iso.date(),
    description: z.string().nullable(),
    createdByUserId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("CaseEvent");

export const CaseEventInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    type: CaseEventTypeSchema,
    date: z.iso.date(),
    description: z.string().trim().max(2_000).nullable().optional(),
  })
  .openapi("CaseEventInput");

export const CaseEventUpdateSchema = CaseEventInputSchema.partial()
  .extend({ expectedUpdatedAt: z.iso.datetime() })
  .refine(
    (input) => Object.keys(input).some((key) => key !== "expectedUpdatedAt"),
    {
      message: "At least one event field is required",
    },
  )
  .openapi("CaseEventUpdate");

const CaseEventVersionSchema = z
  .object({ expectedUpdatedAt: z.iso.datetime() })
  .openapi("CaseEventVersion");

const CaseEventPaginationSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("CaseEventPagination");

const CaseEventListResponseSchema = z
  .object({
    events: z.array(CaseEventSchema),
    pagination: CaseEventPaginationSchema,
  })
  .openapi("CaseEventListResponse");

const CaseEventResponseSchema = z
  .object({ event: CaseEventSchema })
  .openapi("CaseEventResponse");

const CaseEventCalendarItemSchema = CaseEventSchema.extend({
  case: z.object({
    id: z.string(),
    identification: z.string(),
    status: CaseStatusSchema,
    type: CaseTypeSchema.nullable(),
    stage: CaseStageSchema.nullable(),
    docketNumber: z.string().nullable(),
    client: z.object({ id: z.string(), name: z.string() }),
  }),
}).openapi("CaseEventCalendarItem");

const CaseEventCalendarResponseSchema = z
  .object({
    events: z.array(CaseEventCalendarItemSchema),
    truncated: z.boolean(),
  })
  .openapi("CaseEventCalendarResponse");

const CaseArchivedErrorSchema = z.object({
  error: z.object({
    code: z.literal("CASE_ARCHIVED"),
    message: z.string(),
  }),
});

const CaseEventConflictErrorSchema = z.object({
  error: z.object({
    code: z.literal("CONFLICT"),
    message: z.string(),
  }),
});

const caseParams = z.object({ caseId: z.string().min(1) });
const eventParams = caseParams.extend({ eventId: z.string().min(1) });

const calendarQuery = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    caseStatus: CaseStatusSchema,
    search: z.string().trim().max(500).optional(),
    type: z.union([CaseTypeSchema, z.array(CaseTypeSchema)]).optional(),
    client: z.union([z.string(), z.array(z.string())]).optional(),
    member: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .transform((value) => ({
    from: value.from,
    to: value.to,
    caseStatus: value.caseStatus,
    search: value.search,
    types: value.type
      ? Array.isArray(value.type)
        ? value.type
        : [value.type]
      : [],
    clientIds: value.client
      ? Array.isArray(value.client)
        ? value.client
        : [value.client]
      : [],
    memberUserIds: value.member
      ? Array.isArray(value.member)
        ? value.member
        : [value.member]
      : [],
  }));

const errors = {
  ...rateLimitedErrorResponse,
  400: {
    description: "Invalid event input",
    content: { "application/json": { schema: ValidationErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  403: {
    description: "Studio membership required",
    content: { "application/json": { schema: ForbiddenErrorSchema } },
  },
  404: {
    description: "Case or event not found",
    content: { "application/json": { schema: NotFoundErrorSchema } },
  },
  409: {
    description: "Organization required or case archived",
    content: {
      "application/json": {
        schema: z.union([
          OrganizationRequiredErrorSchema,
          CaseArchivedErrorSchema,
        ]),
      },
    },
  },
} as const;

const versionConflictErrorResponse = {
  409: {
    description: "Organization required, case archived, or version conflict",
    content: {
      "application/json": {
        schema: z.union([
          OrganizationRequiredErrorSchema,
          CaseArchivedErrorSchema,
          CaseEventConflictErrorSchema,
        ]),
      },
    },
  },
} as const;

export const listCaseEventsRoute = createRoute({
  method: "get",
  path: "/api/cases/{caseId}/events",
  operationId: "listCaseEvents",
  tags: ["Case Events"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
  },
  responses: {
    200: {
      description: "Paginated case events",
      content: {
        "application/json": { schema: CaseEventListResponseSchema },
      },
    },
    ...errors,
  },
});

export const listCaseEventCalendarRoute = createRoute({
  method: "get",
  path: "/api/case-events/calendar",
  operationId: "listCaseEventCalendar",
  tags: ["Case Events"],
  security: [{ sessionCookie: [] }],
  request: { query: calendarQuery },
  responses: {
    200: {
      description: "Case events in a visible calendar range",
      content: {
        "application/json": { schema: CaseEventCalendarResponseSchema },
      },
    },
    ...errors,
  },
});

export const createCaseEventRoute = createRoute({
  method: "post",
  path: "/api/cases/{caseId}/events",
  operationId: "createCaseEvent",
  tags: ["Case Events"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    body: {
      required: true,
      content: { "application/json": { schema: CaseEventInputSchema } },
    },
  },
  responses: {
    201: {
      description: "Created case event",
      content: { "application/json": { schema: CaseEventResponseSchema } },
    },
    ...errors,
  },
});

export const updateCaseEventRoute = createRoute({
  method: "patch",
  path: "/api/cases/{caseId}/events/{eventId}",
  operationId: "updateCaseEvent",
  tags: ["Case Events"],
  security: [{ sessionCookie: [] }],
  request: {
    params: eventParams,
    body: {
      required: true,
      content: { "application/json": { schema: CaseEventUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated case event",
      content: { "application/json": { schema: CaseEventResponseSchema } },
    },
    ...errors,
    ...versionConflictErrorResponse,
  },
});

export const deleteCaseEventRoute = createRoute({
  method: "delete",
  path: "/api/cases/{caseId}/events/{eventId}",
  operationId: "deleteCaseEvent",
  tags: ["Case Events"],
  security: [{ sessionCookie: [] }],
  request: {
    params: eventParams,
    body: {
      required: true,
      content: { "application/json": { schema: CaseEventVersionSchema } },
    },
  },
  responses: {
    204: { description: "Deleted case event" },
    ...errors,
    ...versionConflictErrorResponse,
  },
});
