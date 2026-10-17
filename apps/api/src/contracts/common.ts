import { z } from "@hono/zod-openapi";

import { RATE_LIMITED_MESSAGE } from "../rate-limit/rate-limit-types";

export const UnauthorizedErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("UNAUTHORIZED"),
      message: z.literal("Autenticación requerida."),
    }),
  })
  .openapi("UnauthorizedError");

export const OrganizationRequiredErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("ORGANIZATION_REQUIRED"),
      message: z.literal("Selecciona un estudio para continuar."),
    }),
  })
  .openapi("OrganizationRequiredError");

export const ForbiddenErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("FORBIDDEN"),
      message: z.literal("No tienes acceso a este estudio."),
    }),
  })
  .openapi("ForbiddenError");

export const FeatureDisabledErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("FEATURE_DISABLED"),
      message: z.literal("Esta función no está habilitada para este estudio."),
    }),
  })
  .openapi("FeatureDisabledError");

export const HelpRateLimitedErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("HELP_RATE_LIMITED"),
      message: z.string(),
    }),
  })
  .openapi("HelpRateLimitedError");

export const HelpProviderUnavailableErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("HELP_PROVIDER_UNAVAILABLE"),
      message: z.string(),
    }),
  })
  .openapi("HelpProviderUnavailableError");

export const RateLimitedErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("RATE_LIMITED"),
      message: z.literal(RATE_LIMITED_MESSAGE),
      retryAfterSeconds: z.number().int().min(1),
    }),
  })
  .openapi("RateLimitedError");

export const rateLimitedErrorResponse = {
  429: {
    description: "The authenticated user reached the temporary API limit.",
    content: { "application/json": { schema: RateLimitedErrorSchema } },
  },
} as const;

export const NotFoundErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("NOT_FOUND"),
      message: z.literal("Cliente no encontrado."),
    }),
  })
  .openapi("NotFoundError");

export const ValidationErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("VALIDATION_ERROR"),
      message: z.literal("Revisa los datos enviados."),
    }),
  })
  .openapi("ValidationError");
