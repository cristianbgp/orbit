import { createRoute, z } from "@hono/zod-openapi";

import {
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
} from "./common";

const StageNameSchema = z.string().trim().min(1).max(160);
const StageDescriptionSchema = z.string().trim().max(2_000).optional();

export const ProjectStageSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    position: z.number().int().min(0),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("ProjectStage");

export const ProjectStageInputSchema = z
  .object({
    name: StageNameSchema,
    description: StageDescriptionSchema,
  })
  .openapi("ProjectStageInput");

export const ProjectStageUpdateSchema = ProjectStageInputSchema.partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one stage field is required",
  })
  .openapi("ProjectStageUpdate");

export const ProjectStageOrderInputSchema = z
  .object({
    stageIds: z
      .array(z.string().min(1))
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Stage IDs must be unique",
      }),
  })
  .openapi("ProjectStageOrderInput");

const ProjectStageResponseSchema = z
  .object({ stage: ProjectStageSchema })
  .openapi("ProjectStageResponse");

const ProjectStageListResponseSchema = z
  .object({ stages: z.array(ProjectStageSchema) })
  .openapi("ProjectStageListResponse");

const ProjectStageErrorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        "FORBIDDEN",
        "NOT_FOUND",
        "INVALID_ORDER",
        "CONFLICT",
        "PROJECT_ARCHIVED",
      ]),
      message: z.string(),
    }),
  })
  .openapi("ProjectStageError");

const ValidationErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("VALIDATION_ERROR"),
      message: z.string(),
    }),
  })
  .openapi("ProjectStageValidationError");

const projectParams = z.object({ projectId: z.string().min(1) });
const stageParams = projectParams.extend({ stageId: z.string().min(1) });
const security = [{ sessionCookie: [] }];

const commonResponses = {
  ...rateLimitedErrorResponse,
  401: {
    description: "Authentication is required.",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  409: {
    description: "An active organization is required.",
    content: {
      "application/json": {
        schema: z.union([
          OrganizationRequiredErrorSchema,
          ProjectStageErrorSchema,
        ]),
      },
    },
  },
};

const protectedResponses = {
  ...commonResponses,
  403: {
    description: "The active membership cannot perform this operation.",
    content: { "application/json": { schema: ProjectStageErrorSchema } },
  },
  404: {
    description: "The project or stage is unavailable.",
    content: { "application/json": { schema: ProjectStageErrorSchema } },
  },
};

export const listProjectStagesRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/stages",
  operationId: "listProjectStages",
  tags: ["Project stages"],
  security,
  request: { params: projectParams },
  responses: {
    200: {
      description: "Ordered stages in one project.",
      content: {
        "application/json": { schema: ProjectStageListResponseSchema },
      },
    },
    ...protectedResponses,
  },
});

export const createProjectStageRoute = createRoute({
  method: "post",
  path: "/api/projects/{projectId}/stages",
  operationId: "createProjectStage",
  tags: ["Project stages"],
  security,
  request: {
    params: projectParams,
    body: {
      required: true,
      content: { "application/json": { schema: ProjectStageInputSchema } },
    },
  },
  responses: {
    201: {
      description: "A manually created project stage.",
      content: { "application/json": { schema: ProjectStageResponseSchema } },
    },
    400: {
      description: "Invalid stage input.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...protectedResponses,
  },
});

export const updateProjectStageRoute = createRoute({
  method: "patch",
  path: "/api/projects/{projectId}/stages/{stageId}",
  operationId: "updateProjectStage",
  tags: ["Project stages"],
  security,
  request: {
    params: stageParams,
    body: {
      required: true,
      content: { "application/json": { schema: ProjectStageUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated project stage.",
      content: { "application/json": { schema: ProjectStageResponseSchema } },
    },
    400: {
      description: "Invalid stage update.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...protectedResponses,
  },
});

export const reorderProjectStagesRoute = createRoute({
  method: "put",
  path: "/api/projects/{projectId}/stages/order",
  operationId: "reorderProjectStages",
  tags: ["Project stages"],
  security,
  request: {
    params: projectParams,
    body: {
      required: true,
      content: {
        "application/json": { schema: ProjectStageOrderInputSchema },
      },
    },
  },
  responses: {
    200: {
      description: "The final ordered project stages.",
      content: {
        "application/json": { schema: ProjectStageListResponseSchema },
      },
    },
    400: {
      description: "Invalid or stale complete order.",
      content: {
        "application/json": {
          schema: z.union([ValidationErrorSchema, ProjectStageErrorSchema]),
        },
      },
    },
    ...protectedResponses,
  },
});

export const deleteProjectStageRoute = createRoute({
  method: "delete",
  path: "/api/projects/{projectId}/stages/{stageId}",
  operationId: "deleteProjectStage",
  tags: ["Project stages"],
  security,
  request: { params: stageParams },
  responses: {
    204: { description: "The stage was deleted." },
    ...protectedResponses,
  },
});
