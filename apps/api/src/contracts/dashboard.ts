import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";
import { ProjectActivitySchema } from "./project-collaboration";

const DashboardActivityPreviewSchema = ProjectActivitySchema.extend({
  source: z.enum(["project", "case"]),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
      status: z.enum(["draft", "active", "completed"]),
      archivedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  case: z
    .object({
      id: z.string(),
      identification: z.string(),
      status: z.enum(["in_progress", "concluded"]),
      archivedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
}).openapi("DashboardActivityPreview");

const DashboardActivityPageSchema = z
  .object({
    timeZone: z.string().min(1),
    activities: z.array(DashboardActivityPreviewSchema).max(50),
    nextCursor: z.string().nullable(),
  })
  .openapi("DashboardActivityPage");

export const listDashboardActivityRoute = createRoute({
  method: "get",
  path: "/api/dashboard/activity",
  operationId: "listDashboardActivity",
  tags: ["Dashboard"],
  security: [{ sessionCookie: [] }],
  request: {
    query: z.object({
      cursor: z.string().trim().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(50).default(25),
    }),
  },
  responses: {
    200: {
      description: "Newest-first studio activity page.",
      content: { "application/json": { schema: DashboardActivityPageSchema } },
    },
    400: {
      description: "The cursor or page size is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    401: {
      description: "Authentication is required.",
      content: { "application/json": { schema: UnauthorizedErrorSchema } },
    },
    403: {
      description: "The user is not a member of the active organization.",
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
