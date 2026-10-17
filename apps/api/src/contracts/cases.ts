import { createRoute, z } from "@hono/zod-openapi";
import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  OrganizationRequiredErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
  rateLimitedErrorResponse,
} from "./common";

export const CaseTypeSchema = z.enum([
  "administrative",
  "judicial",
  "constitutional",
  "other",
]);
export const CaseSubtypeSchema = z.enum([
  "administrative_tax_litigation",
  "refund",
  "audit",
  "non_contentious",
  "limitation",
  "precautionary_notebook",
  "appeal_notebook",
  "dca",
  "dca_sunat",
  "cassation_complaint",
  "amparo",
  "written_submission",
  "special_installment_dl_1634",
  "official_letter",
  "petition",
]);
export const CaseStageSchema = z.enum([
  "administrative_appeal",
  "administrative_compliance",
  "administrative_refund",
  "administrative_audit",
  "administrative_installment",
  "administrative_limitation",
  "administrative_claim",
  "administrative_review_appeal",
  "administrative_non_contentious_request",
  "administrative_minem_verification",
  "judicial_cassation",
  "judicial_enforcement",
  "judicial_first_instance",
  "judicial_second_instance",
  "constitutional_first_instance",
]);
export const CaseEntitySchema = z.enum([
  "tax_court",
  "sunat",
  "mef",
  "municipality",
  "sat",
  "minem",
  "judiciary",
]);
export const CaseTaxSchema = z.enum([
  "IGV",
  "IR",
  "IR_ND",
  "ITAN",
  "OTR",
  "PREDIAL",
]);
export const CaseCurrencySchema = z.enum(["PEN", "USD"]);
export const CaseClaimantTypeSchema = z.enum(["client", "sunat"]);
export const CaseStatusSchema = z.enum(["in_progress", "concluded"]);
export const CaseResultSchema = z.enum([
  "founded",
  "unfounded",
  "inadmissible",
]);
const NullableText = z.string().trim().max(4_000).nullable().optional();
const PeriodSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("year"),
      year: z.number().int().min(1).max(9999),
    }),
    z.object({
      kind: z.literal("month"),
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    }),
    z.object({
      kind: z.literal("month_range"),
      startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      endMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    }),
  ])
  .nullable();

export const CaseInputSchema = z
  .object({
    clientId: z.string().trim().min(1),
    identification: z.string().trim().min(2).max(500),
    type: CaseTypeSchema.nullable().optional(),
    subtype: CaseSubtypeSchema.nullable().optional(),
    stage: CaseStageSchema.nullable().optional(),
    entity: CaseEntitySchema.nullable().optional(),
    docketNumber: NullableText,
    tax: CaseTaxSchema.nullable().optional(),
    period: PeriodSchema.optional(),
    amount: z.string().trim().max(19).nullable().optional(),
    currency: CaseCurrencySchema.nullable().optional(),
    claimantType: CaseClaimantTypeSchema.nullable().optional(),
    disputedMatter: NullableText,
    challengedResolution: NullableText,
    status: CaseStatusSchema.optional(),
    result: CaseResultSchema.nullable().optional(),
    initialMemberUserIds: z.array(z.string().min(1)).max(100).optional(),
    initialFollowerUserIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .openapi("CaseInput");
export const CaseUpdateSchema = CaseInputSchema.omit({
  initialMemberUserIds: true,
  initialFollowerUserIds: true,
})
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one case field is required",
  })
  .openapi("CaseUpdate");

const CaseMemberSchema = z.object({
  userId: z.string(),
  fullName: z.string(),
  alias: z.string(),
  avatarColor: z.string().nullable(),
  position: z
    .enum(["partner", "senior", "junior", "assistant", "intern"])
    .nullable(),
});
const CaseSchema = z
  .object({
    id: z.string(),
    clientId: z.string(),
    client: z.object({ id: z.string(), name: z.string() }),
    identification: z.string(),
    type: CaseTypeSchema.nullable(),
    subtype: CaseSubtypeSchema.nullable(),
    stage: CaseStageSchema.nullable(),
    entity: CaseEntitySchema.nullable(),
    docketNumber: z.string().nullable(),
    tax: CaseTaxSchema.nullable(),
    periodKind: z.enum(["year", "month", "month_range"]).nullable(),
    periodStart: z.string().nullable(),
    periodEnd: z.string().nullable(),
    amount: z.string().nullable(),
    currency: CaseCurrencySchema.nullable(),
    claimantType: CaseClaimantTypeSchema.nullable(),
    disputedMatter: z.string().nullable(),
    challengedResolution: z.string().nullable(),
    status: CaseStatusSchema,
    result: CaseResultSchema.nullable(),
    team: z.object({
      members: z.array(CaseMemberSchema),
      total: z.number().int(),
    }),
    followers: z.object({
      members: z.array(CaseMemberSchema),
      total: z.number().int(),
    }),
    activeActionCount: z.number().int().nonnegative(),
    activeUpdateCount: z.number().int().nonnegative(),
    archivedAt: z.iso.datetime().nullable(),
    createdByUserId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("LegalCase");
const PaginationSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
const CaseResponseSchema = z.object({ case: CaseSchema });

const authErrors = {
  ...rateLimitedErrorResponse,
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  403: {
    description: "Forbidden",
    content: { "application/json": { schema: ForbiddenErrorSchema } },
  },
  409: {
    description: "Organization or lifecycle conflict",
    content: {
      "application/json": { schema: OrganizationRequiredErrorSchema },
    },
  },
} as const;
const query = z.object({
  search: z.string().trim().max(500).optional(),
  type: z.union([CaseTypeSchema, z.array(CaseTypeSchema)]).optional(),
  status: z.union([CaseStatusSchema, z.array(CaseStatusSchema)]).optional(),
  client: z.union([z.string(), z.array(z.string())]).optional(),
  member: z.union([z.string(), z.array(z.string())]).optional(),
  archived: z.stringbool().optional(),
  orderBy: z.enum(["identification", "createdAt", "updatedAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const normalizeArrayQuery = (schema: typeof query) =>
  schema.transform((value) => ({
    ...value,
    type: value.type
      ? Array.isArray(value.type)
        ? value.type
        : [value.type]
      : undefined,
    status: value.status
      ? Array.isArray(value.status)
        ? value.status
        : [value.status]
      : undefined,
    client: value.client
      ? Array.isArray(value.client)
        ? value.client
        : [value.client]
      : undefined,
    member: value.member
      ? Array.isArray(value.member)
        ? value.member
        : [value.member]
      : undefined,
  }));

export const listCasesRoute = createRoute({
  method: "get",
  path: "/api/cases",
  operationId: "listCases",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: { query: normalizeArrayQuery(query) },
  responses: {
    200: {
      description: "Cases",
      content: {
        "application/json": {
          schema: z.object({
            cases: z.array(CaseSchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    400: {
      description: "Invalid query",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});
export const listCasesGroupedByClientRoute = createRoute({
  method: "get",
  path: "/api/cases/grouped-by-client",
  operationId: "listCasesGroupedByClient",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: {
    query: normalizeArrayQuery(
      query.extend({
        pageSize: z.coerce.number().int().min(1).max(50).default(10),
      }),
    ),
  },
  responses: {
    200: {
      description: "Cases grouped by client",
      content: {
        "application/json": {
          schema: z.object({
            groups: z.array(
              z.object({
                client: z.object({ id: z.string(), name: z.string() }),
                cases: z.array(CaseSchema),
              }),
            ),
            caseTotal: z.number().int(),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    ...authErrors,
  },
});

const option = z.object({ value: z.string(), label: z.string() });
export const getCaseOptionsRoute = createRoute({
  method: "get",
  path: "/api/cases/options",
  operationId: "getCaseOptions",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Fixed case catalogs",
      content: {
        "application/json": {
          schema: z.object({
            types: z.array(option),
            subtypes: z.array(option.extend({ type: CaseTypeSchema })),
            stages: z.array(option.extend({ type: CaseTypeSchema })),
            entities: z.array(option),
            taxes: z.array(option),
            currencies: z.array(option),
            statuses: z.array(option),
            results: z.array(option),
          }),
        },
      },
    },
    ...authErrors,
  },
});
export const createCaseRoute = createRoute({
  method: "post",
  path: "/api/cases",
  operationId: "createCase",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CaseInputSchema } },
    },
  },
  responses: {
    201: {
      description: "Created case",
      content: { "application/json": { schema: CaseResponseSchema } },
    },
    400: {
      description: "Invalid input",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});
const caseParams = z.object({ caseId: z.string().min(1) });
export const getCaseRoute = createRoute({
  method: "get",
  path: "/api/cases/{caseId}",
  operationId: "getCase",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: { params: caseParams },
  responses: {
    200: {
      description: "Case",
      content: { "application/json": { schema: CaseResponseSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: NotFoundErrorSchema } },
    },
    ...authErrors,
  },
});
export const updateCaseRoute = createRoute({
  method: "patch",
  path: "/api/cases/{caseId}",
  operationId: "updateCase",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    body: {
      required: true,
      content: { "application/json": { schema: CaseUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated case",
      content: { "application/json": { schema: CaseResponseSchema } },
    },
    400: {
      description: "Invalid input",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: NotFoundErrorSchema } },
    },
    ...authErrors,
  },
});
export const archiveCaseRoute = createRoute({
  method: "post",
  path: "/api/cases/{caseId}/archive",
  operationId: "archiveCase",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: { params: caseParams },
  responses: {
    200: {
      description: "Archived case",
      content: { "application/json": { schema: CaseResponseSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: NotFoundErrorSchema } },
    },
    ...authErrors,
  },
});
export const restoreCaseRoute = createRoute({
  method: "post",
  path: "/api/cases/{caseId}/restore",
  operationId: "restoreCase",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: { params: caseParams },
  responses: {
    200: {
      description: "Restored case",
      content: { "application/json": { schema: CaseResponseSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: NotFoundErrorSchema } },
    },
    ...authErrors,
  },
});

const AssignmentSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  userName: z.string(),
  userEmail: z.string(),
  userAlias: z.string(),
  userAvatarColor: z.string().nullable(),
  position: z
    .enum(["partner", "senior", "junior", "assistant", "intern"])
    .nullable(),
  activeStudioMember: z.boolean(),
  assignedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  responsibility: z.enum(["member", "follower"]),
});
export const listCaseAssignmentsRoute = createRoute({
  method: "get",
  path: "/api/cases/{caseId}/assignments",
  operationId: "listCaseAssignments",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    query: z.object({
      responsibility: z.enum(["member", "follower"]).default("member"),
      historyPage: z.coerce.number().int().min(1).default(1),
      historyPageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      description: "Case assignments",
      content: {
        "application/json": {
          schema: z.object({
            active: z.array(AssignmentSchema),
            history: z.array(AssignmentSchema),
            historyTotal: z.number().int(),
          }),
        },
      },
    },
    ...authErrors,
  },
});
export const listCaseAssignmentCandidatesRoute = createRoute({
  method: "get",
  path: "/api/cases/{caseId}/assignments/candidates",
  operationId: "listCaseAssignmentCandidates",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    query: z.object({
      responsibility: z.enum(["member", "follower"]).default("member"),
    }),
  },
  responses: {
    200: {
      description: "Assignment candidates",
      content: {
        "application/json": {
          schema: z.object({ members: z.array(CaseMemberSchema) }),
        },
      },
    },
    ...authErrors,
  },
});
export const addCaseAssignmentsRoute = createRoute({
  method: "post",
  path: "/api/cases/{caseId}/assignments",
  operationId: "addCaseAssignments",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            userIds: z.array(z.string().min(1)).min(1).max(100),
            responsibility: z.enum(["member", "follower"]).default("member"),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: "Assignments added" },
    400: {
      description: "Invalid input",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});
export const endCaseAssignmentRoute = createRoute({
  method: "post",
  path: "/api/cases/{caseId}/assignments/{assignmentId}/end",
  operationId: "endCaseAssignment",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: { params: caseParams.extend({ assignmentId: z.string().min(1) }) },
  responses: { 204: { description: "Assignment ended" }, ...authErrors },
});
const CaseActivityIdentitySchema = z.object({
  userId: z.string().nullable(),
  nameSnapshot: z.string(),
  alias: z.string().nullable(),
  avatarColor: z.string().nullable(),
  activeStudioMember: z.boolean(),
  linkable: z.boolean(),
});
const ActivitySchema = z.object({
  id: z.string(),
  type: z.string(),
  actor: CaseActivityIdentitySchema,
  subject: CaseActivityIdentitySchema.nullable(),
  details: z.record(z.string(), z.string().nullable()),
  createdAt: z.iso.datetime(),
});
export const listCaseActivitiesRoute = createRoute({
  method: "get",
  path: "/api/cases/{caseId}/activity",
  operationId: "listCaseActivities",
  tags: ["Cases"],
  security: [{ sessionCookie: [] }],
  request: {
    params: caseParams,
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      description: "Case activity",
      content: {
        "application/json": {
          schema: z.object({
            activities: z.array(ActivitySchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    ...authErrors,
  },
});
