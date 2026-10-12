import { createRoute, z } from "@hono/zod-openapi";

import { CaseActionEntrySchema } from "./case-actions";
import { CaseEventSchema } from "./case-events";
import { CaseUpdateEntrySchema } from "./case-updates";
import {
  CaseResultSchema,
  CaseStageSchema,
  CaseStatusSchema,
  CaseTypeSchema,
} from "./cases";
import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
  rateLimitedErrorResponse,
} from "./common";

const queryArray = <T extends z.ZodType>(schema: T) =>
  z.union([schema, z.array(schema)]).optional();
const values = <T>(value: T | T[] | undefined) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

const CasePresentationMemberSchema = z.object({
  assignmentId: z.string(),
  userId: z.string().nullable(),
  fullName: z.string(),
  alias: z.string(),
  avatarColor: z.string().nullable(),
  position: z
    .enum(["partner", "senior", "junior", "assistant", "intern"])
    .nullable(),
  activeStudioMember: z.boolean(),
});

const CasePresentationCaseSchema = z.object({
  id: z.string(),
  identification: z.string(),
  status: CaseStatusSchema,
  result: CaseResultSchema.nullable(),
  type: CaseTypeSchema.nullable(),
  stage: CaseStageSchema.nullable(),
  docketNumber: z.string().nullable(),
  periodKind: z.enum(["year", "month", "month_range"]).nullable(),
  periodStart: z.iso.date().nullable(),
  periodEnd: z.iso.date().nullable(),
  team: z.array(CasePresentationMemberSchema),
  followers: z.array(CasePresentationMemberSchema),
  updates: z.array(CaseUpdateEntrySchema),
  backgrounds: z.array(CaseUpdateEntrySchema),
  actions: z.array(CaseActionEntrySchema),
  events: z.array(CaseEventSchema),
});

const CasePresentationResponseSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    organizationDate: z.iso.date(),
    clients: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        cases: z.array(CasePresentationCaseSchema),
      }),
    ),
    truncated: z.object({
      value: z.boolean(),
      scopes: z.array(z.enum(["cases", "updates", "actions", "events"])),
    }),
  })
  .openapi("CasePresentationResponse");

const query = z
  .object({
    statuses: queryArray(CaseStatusSchema),
    clientIds: queryArray(z.string().min(1)),
    types: queryArray(CaseTypeSchema),
    memberUserIds: queryArray(z.string().min(1)),
    includeCompletedActions: z.stringbool().optional(),
    includePastEvents: z.stringbool().optional(),
  })
  .transform((input) => ({
    statuses: values(input.statuses),
    clientIds: values(input.clientIds),
    types: values(input.types),
    memberUserIds: values(input.memberUserIds),
    includeCompletedActions: input.includeCompletedActions,
    includePastEvents: input.includePastEvents,
  }));

export const getCasePresentationRoute = createRoute({
  method: "get",
  path: "/api/cases/presentation",
  operationId: "getCasePresentation",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: { query },
  responses: {
    200: {
      description: "Weekly Case presentation",
      content: {
        "application/json": { schema: CasePresentationResponseSchema },
      },
    },
    400: {
      description: "Invalid query",
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
    409: {
      description: "Active organization required",
      content: {
        "application/json": { schema: OrganizationRequiredErrorSchema },
      },
    },
    ...rateLimitedErrorResponse,
  },
});
