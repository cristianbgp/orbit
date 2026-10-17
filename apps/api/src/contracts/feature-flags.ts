import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
} from "./common";

export const FeatureFlagsSchema = z
  .object({
    orbitHelpAssistant: z.boolean(),
  })
  .openapi("FeatureFlags");

export const FeatureFlagsResponseSchema = z
  .object({
    features: FeatureFlagsSchema,
  })
  .openapi("FeatureFlagsResponse");

export const getFeatureFlagsRoute = createRoute({
  method: "get",
  path: "/api/features",
  operationId: "getFeatureFlags",
  tags: ["Feature flags"],
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Effective capabilities for the active organization.",
      content: {
        "application/json": { schema: FeatureFlagsResponseSchema },
      },
    },
    401: {
      description: "Authentication is required.",
      content: { "application/json": { schema: UnauthorizedErrorSchema } },
    },
    403: {
      description: "The user cannot access the active organization.",
      content: { "application/json": { schema: ForbiddenErrorSchema } },
    },
    409: {
      description: "An active organization is required.",
      content: {
        "application/json": { schema: OrganizationRequiredErrorSchema },
      },
    },
    ...rateLimitedErrorResponse,
  },
});
