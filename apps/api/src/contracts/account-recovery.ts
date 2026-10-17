import { createRoute, z } from "@hono/zod-openapi";

import {
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
} from "./common";

const AccountRecoveryLinkSchema = z
  .object({
    url: z.url(),
    expiresAt: z.iso.datetime(),
  })
  .openapi("AccountRecoveryLink");

function errorSchema<Code extends string, Message extends string>(
  name: string,
  code: Code,
  message: Message,
) {
  return z
    .object({
      error: z.object({
        code: z.literal(code),
        message: z.literal(message),
      }),
    })
    .openapi(name);
}

const forbidden = errorSchema(
  "AccountRecoveryForbiddenError",
  "FORBIDDEN",
  "Solo el propietario puede generar enlaces de recuperación.",
);
const notFound = errorSchema(
  "AccountRecoveryNotFoundError",
  "NOT_FOUND",
  "Miembro no encontrado.",
);
const unavailable = errorSchema(
  "AccountRecoveryUnavailableError",
  "UNAVAILABLE",
  "No pudimos generar el enlace de recuperación.",
);

export const createMemberPasswordRecoveryLinkRoute = createRoute({
  method: "post",
  path: "/api/team/users/{userId}/password-recovery-link",
  operationId: "createMemberPasswordRecoveryLink",
  tags: ["Team"],
  security: [{ sessionCookie: [] }],
  request: {
    params: z.object({ userId: z.string().min(1) }),
  },
  responses: {
    200: {
      description:
        "A one-use password recovery link that expires in 30 minutes.",
      content: { "application/json": { schema: AccountRecoveryLinkSchema } },
    },
    401: {
      description: "Authentication is required.",
      content: { "application/json": { schema: UnauthorizedErrorSchema } },
    },
    403: {
      description: "Only the studio owner can generate recovery links.",
      content: { "application/json": { schema: forbidden } },
    },
    404: {
      description: "The target is not an active member of the studio.",
      content: { "application/json": { schema: notFound } },
    },
    409: {
      description: "An active organization is required.",
      content: {
        "application/json": { schema: OrganizationRequiredErrorSchema },
      },
    },
    ...rateLimitedErrorResponse,
    503: {
      description: "The recovery link could not be generated.",
      content: { "application/json": { schema: unavailable } },
    },
  },
});
