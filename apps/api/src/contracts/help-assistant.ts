import { createRoute, z } from "@hono/zod-openapi";

import {
  FeatureDisabledErrorSchema,
  HelpProviderUnavailableErrorSchema,
  HelpRateLimitedErrorSchema,
  OrganizationRequiredErrorSchema,
  RateLimitedErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";

export const OrbitHelpQuestionSchema = z
  .object({
    question: z.string().trim().min(2).max(500),
  })
  .openapi("OrbitHelpQuestion");

export const OrbitHelpSourceSchema = z
  .object({
    document: z.string(),
    section: z.string(),
  })
  .openapi("OrbitHelpSource");

export const OrbitHelpResponseSchema = z
  .object({
    answer: z.string(),
    sources: z.array(OrbitHelpSourceSchema).max(5),
  })
  .openapi("OrbitHelpResponse");

const OrbitHelpRateLimitedErrorSchema = z
  .union([RateLimitedErrorSchema, HelpRateLimitedErrorSchema])
  .openapi("OrbitHelpRateLimitedError");

export const askOrbitHelpRoute = createRoute({
  method: "post",
  path: "/api/help/ask",
  operationId: "askOrbitHelp",
  tags: ["Orbit help"],
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      content: { "application/json": { schema: OrbitHelpQuestionSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "A documentation-grounded Orbit help answer.",
      content: { "application/json": { schema: OrbitHelpResponseSchema } },
    },
    400: {
      description: "The question is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    401: {
      description: "Authentication is required.",
      content: { "application/json": { schema: UnauthorizedErrorSchema } },
    },
    403: {
      description: "The feature is disabled for the active organization.",
      content: { "application/json": { schema: FeatureDisabledErrorSchema } },
    },
    409: {
      description: "An active organization is required.",
      content: {
        "application/json": { schema: OrganizationRequiredErrorSchema },
      },
    },
    429: {
      description: "The current user reached a temporary API or help limit.",
      content: {
        "application/json": { schema: OrbitHelpRateLimitedErrorSchema },
      },
    },
    503: {
      description: "The help provider is temporarily unavailable.",
      content: {
        "application/json": { schema: HelpProviderUnavailableErrorSchema },
      },
    },
  },
});
