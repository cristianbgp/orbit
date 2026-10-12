import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  OrganizationRequiredErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
  rateLimitedErrorResponse,
} from "./common";

const CaseActionIdentitySchema = z
  .object({
    userId: z.string().nullable(),
    fullName: z.string(),
    alias: z.string().nullable(),
    avatarColor: z.string().nullable(),
    activeStudioMember: z.boolean(),
    activeCaseMember: z.boolean(),
    linkable: z.boolean(),
  })
  .openapi("CaseActionIdentity");

export const CaseActionEntrySchema = z
  .object({
    id: z.string(),
    caseId: z.string(),
    description: z.string(),
    status: z.enum(["pending", "completed"]),
    assignee: CaseActionIdentitySchema.nullable(),
    creator: CaseActionIdentitySchema,
    completedAt: z.iso.datetime().nullable(),
    completedByUserId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .openapi("CaseActionEntry");

const ListResponseSchema = z
  .object({
    actions: z.array(CaseActionEntrySchema),
    pagination: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  })
  .openapi("CaseActionListResponse");

const CreateBodySchema = z
  .object({
    description: z.string().trim().min(1).max(1_000),
    assigneeUserId: z.string().nullable().optional(),
  })
  .openapi("CreateCaseActionBody");

const UpdateBodySchema = z
  .object({
    description: z.string().trim().min(1).max(1_000).optional(),
    assigneeUserId: z.string().nullable().optional(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .refine(
    (value) =>
      value.description !== undefined || value.assigneeUserId !== undefined,
    {
      message: "At least one update field is required",
    },
  )
  .openapi("UpdateCaseActionBody");

const VersionBodySchema = z
  .object({ expectedUpdatedAt: z.iso.datetime() })
  .openapi("CaseActionVersionBody");
const ResponseSchema = z.object({ action: CaseActionEntrySchema });
const caseParams = z.object({ caseId: z.string().min(1) });
const actionParams = caseParams.extend({ actionId: z.string().min(1) });
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
    description: "Case action not found",
    content: { "application/json": { schema: NotFoundErrorSchema } },
  },
  409: {
    description: "Lifecycle or version conflict",
    content: {
      "application/json": { schema: OrganizationRequiredErrorSchema },
    },
  },
} as const;

export const listCaseActionsRoute = createRoute({
  method: "get",
  path: "/api/cases/{caseId}/actions",
  operationId: "listCaseActions",
  tags: ["Case Actions"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    query: z.object({
      status: z
        .enum(["active", "pending", "completed", "archived"])
        .default("pending"),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      description: "Case actions",
      content: { "application/json": { schema: ListResponseSchema } },
    },
    ...errors,
  },
});

export const createCaseActionRoute = createRoute({
  method: "post",
  path: "/api/cases/{caseId}/actions",
  operationId: "createCaseAction",
  tags: ["Case Actions"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    body: {
      required: true,
      content: { "application/json": { schema: CreateBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Created case action",
      content: { "application/json": { schema: ResponseSchema } },
    },
    ...errors,
  },
});

export const updateCaseActionRoute = createRoute({
  method: "patch",
  path: "/api/cases/{caseId}/actions/{actionId}",
  operationId: "updateCaseAction",
  tags: ["Case Actions"],
  security: [{ sessionCookie: [] }],
  request: {
    params: actionParams,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Updated case action",
      content: { "application/json": { schema: ResponseSchema } },
    },
    ...errors,
  },
});

function lifecycleRoute(
  action: "complete" | "reopen" | "archive" | "restore",
  operationId:
    | "completeCaseAction"
    | "reopenCaseAction"
    | "archiveCaseAction"
    | "restoreCaseAction",
) {
  return createRoute({
    method: "post",
    path: `/api/cases/{caseId}/actions/{actionId}/${action}`,
    operationId,
    tags: ["Case Actions"],
    security: [{ sessionCookie: [] }],
    request: {
      params: actionParams,
      body: {
        required: true,
        content: { "application/json": { schema: VersionBodySchema } },
      },
    },
    responses: {
      200: {
        description: `${action} case action`,
        content: { "application/json": { schema: ResponseSchema } },
      },
      ...errors,
    },
  });
}

export const completeCaseActionRoute = lifecycleRoute(
  "complete",
  "completeCaseAction",
);
export const reopenCaseActionRoute = lifecycleRoute(
  "reopen",
  "reopenCaseAction",
);
export const archiveCaseActionRoute = lifecycleRoute(
  "archive",
  "archiveCaseAction",
);
export const restoreCaseActionRoute = lifecycleRoute(
  "restore",
  "restoreCaseAction",
);
