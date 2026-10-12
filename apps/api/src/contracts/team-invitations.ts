import { createRoute, z } from "@hono/zod-openapi";

import {
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
} from "./common";
import { NullableStudioMemberPositionSchema } from "./identity";

export const TeamInvitationSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    role: z.literal("member"),
    position: NullableStudioMemberPositionSchema,
    status: z.literal("pending"),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .openapi("TeamInvitation");

const TeamInvitationListSchema = z
  .object({ invitations: z.array(TeamInvitationSchema) })
  .openapi("TeamInvitationList");

const TeamInvitationForbiddenSchema = z
  .object({
    error: z.object({
      code: z.literal("FORBIDDEN"),
      message: z.string(),
    }),
  })
  .openapi("TeamInvitationForbidden");

export const listPendingTeamInvitationsRoute = createRoute({
  method: "get",
  path: "/api/team/invitations",
  operationId: "listPendingTeamInvitations",
  tags: ["Team"],
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Pending invitations visible to the organization owner.",
      content: { "application/json": { schema: TeamInvitationListSchema } },
    },
    401: {
      description: "Authentication is required.",
      content: { "application/json": { schema: UnauthorizedErrorSchema } },
    },
    403: {
      description: "Only the organization owner can list invitations.",
      content: {
        "application/json": { schema: TeamInvitationForbiddenSchema },
      },
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
