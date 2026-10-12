import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  OrganizationRequiredErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
  rateLimitedErrorResponse,
} from "./common";

export const CaseUpdateKindSchema = z
  .enum(["update", "background"])
  .openapi("CaseUpdateKind");

const CaseUpdateCreatorSchema = z
  .object({
    userId: z.string().nullable(),
    fullName: z.string(),
    alias: z.string().nullable(),
    avatarColor: z.string().nullable(),
    activeStudioMember: z.boolean(),
    linkable: z.boolean(),
  })
  .openapi("CaseUpdateCreator");

export const CaseUpdateEntrySchema = z
  .object({
    id: z.string(),
    caseId: z.string(),
    date: z.iso.date(),
    description: z.string(),
    kind: CaseUpdateKindSchema,
    creator: CaseUpdateCreatorSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .openapi("CaseUpdateEntry");

const CaseUpdatePaginationSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("CaseUpdatePagination");

const CaseUpdateListResponseSchema = z
  .object({
    updates: z.array(CaseUpdateEntrySchema),
    pagination: CaseUpdatePaginationSchema,
  })
  .openapi("CaseUpdateListResponse");

const CreateCaseUpdateBodySchema = z
  .object({
    date: z.iso.date(),
    description: z.string().trim().min(1).max(5_000),
  })
  .openapi("CreateCaseUpdateBody");

const UpdateCaseUpdateBodySchema = z
  .object({
    date: z.iso.date().optional(),
    description: z.string().trim().min(1).max(5_000).optional(),
    kind: CaseUpdateKindSchema.optional(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .refine(
    (value) =>
      value.date !== undefined ||
      value.description !== undefined ||
      value.kind !== undefined,
    { message: "At least one update field is required" },
  )
  .openapi("UpdateCaseUpdateBody");

const CaseUpdateVersionBodySchema = z
  .object({ expectedUpdatedAt: z.iso.datetime() })
  .openapi("CaseUpdateVersionBody");

const CaseUpdateResponseSchema = z.object({
  update: CaseUpdateEntrySchema,
});

const CaseUpdateBackgroundMoveSummarySchema = z
  .object({
    movedCount: z.number().int().nonnegative(),
    caseCount: z.number().int().nonnegative(),
  })
  .openapi("CaseUpdateBackgroundMoveSummary");

const caseParams = z.object({ caseId: z.string().min(1) });
const updateParams = caseParams.extend({ updateId: z.string().min(1) });

const errors = {
  ...rateLimitedErrorResponse,
  400: {
    description: "Invalid input",
    content: { "application/json": { schema: ValidationErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  403: {
    description: "Forbidden",
    content: { "application/json": { schema: ForbiddenErrorSchema } },
  },
  404: {
    description: "Case update not found",
    content: { "application/json": { schema: NotFoundErrorSchema } },
  },
  409: {
    description: "Lifecycle or version conflict",
    content: {
      "application/json": { schema: OrganizationRequiredErrorSchema },
    },
  },
} as const;

export const listCaseUpdatesRoute = createRoute({
  method: "get",
  path: "/api/cases/{caseId}/updates",
  operationId: "listCaseUpdates",
  tags: ["Case Updates"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    query: z.object({
      status: z.enum(["active", "archived"]).default("active"),
      kind: CaseUpdateKindSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }),
  },
  responses: {
    200: {
      description: "Case updates",
      content: {
        "application/json": { schema: CaseUpdateListResponseSchema },
      },
    },
    ...errors,
  },
});

export const createCaseUpdateRoute = createRoute({
  method: "post",
  path: "/api/cases/{caseId}/updates",
  operationId: "createCaseUpdate",
  tags: ["Case Updates"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    body: {
      required: true,
      content: { "application/json": { schema: CreateCaseUpdateBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Created case update",
      content: { "application/json": { schema: CaseUpdateResponseSchema } },
    },
    ...errors,
  },
});

export const updateCaseUpdateRoute = createRoute({
  method: "patch",
  path: "/api/cases/{caseId}/updates/{updateId}",
  operationId: "updateCaseUpdate",
  tags: ["Case Updates"],
  security: [{ sessionCookie: [] }],
  request: {
    params: updateParams,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateCaseUpdateBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Updated case update",
      content: { "application/json": { schema: CaseUpdateResponseSchema } },
    },
    ...errors,
  },
});

function lifecycleRoute(
  action: "archive" | "restore",
  operationId: "archiveCaseUpdate" | "restoreCaseUpdate",
) {
  return createRoute({
    method: "post",
    path: `/api/cases/{caseId}/updates/{updateId}/${action}`,
    operationId,
    tags: ["Case Updates"],
    security: [{ sessionCookie: [] }],
    request: {
      params: updateParams,
      body: {
        required: true,
        content: {
          "application/json": { schema: CaseUpdateVersionBodySchema },
        },
      },
    },
    responses: {
      200: {
        description: `${action}d case update`,
        content: { "application/json": { schema: CaseUpdateResponseSchema } },
      },
      ...errors,
    },
  });
}

export const archiveCaseUpdateRoute = lifecycleRoute(
  "archive",
  "archiveCaseUpdate",
);
export const restoreCaseUpdateRoute = lifecycleRoute(
  "restore",
  "restoreCaseUpdate",
);

export const moveCaseUpdatesToBackgroundRoute = createRoute({
  method: "post",
  path: "/api/cases/updates/move-to-background",
  operationId: "moveCaseUpdatesToBackground",
  tags: ["Case Updates"],
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Moved active case updates to background",
      content: {
        "application/json": {
          schema: CaseUpdateBackgroundMoveSummarySchema,
        },
      },
    },
    ...errors,
  },
});

export const previewMoveCaseUpdatesToBackgroundRoute = createRoute({
  method: "get",
  path: "/api/cases/updates/move-to-background/preview",
  operationId: "previewMoveCaseUpdatesToBackground",
  tags: ["Case Updates"],
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Organization-wide active novelty conversion scope",
      content: {
        "application/json": { schema: CaseUpdateBackgroundMoveSummarySchema },
      },
    },
    ...errors,
  },
});
