import { createRoute, z } from "@hono/zod-openapi";

import {
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
} from "./common";
import { NullableAvatarColorSchema, UserAliasSchema } from "./identity";

export const ProjectResponsibilitySchema = z
  .enum(["responsible", "member"])
  .openapi("ProjectResponsibility");

export const ProjectAssignmentSchema = z
  .object({
    id: z.string(),
    userId: z.string().nullable(),
    userName: z.string(),
    userEmail: z.string(),
    userAlias: UserAliasSchema,
    userAvatarColor: NullableAvatarColorSchema,
    activeStudioMember: z.boolean(),
    responsibility: ProjectResponsibilitySchema,
    assignedByUserId: z.string().nullable(),
    assignedByName: z.string(),
    assignedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    endedByUserId: z.string().nullable(),
    endedByName: z.string().nullable(),
    endReason: z
      .enum(["project_unassigned", "organization_removed"])
      .nullable(),
  })
  .openapi("ProjectAssignment");

export const ProjectAssignmentCandidateSchema = z
  .object({
    memberId: z.string(),
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    userAlias: UserAliasSchema,
    userAvatarColor: NullableAvatarColorSchema,
    activeStudioMember: z.boolean(),
    assigned: z.boolean(),
  })
  .openapi("ProjectAssignmentCandidate");

export const ProjectActivityIdentitySchema = z
  .object({
    userId: z.string().nullable(),
    alias: z.union([UserAliasSchema, z.null()]),
    avatarColor: NullableAvatarColorSchema,
    nameSnapshot: z.string(),
    activeStudioMember: z.boolean(),
    linkable: z.boolean(),
  })
  .openapi("ProjectActivityIdentity");

export const ProjectActivitySchema = z
  .object({
    id: z.string(),
    type: z.string(),
    actor: ProjectActivityIdentitySchema,
    subject: z.union([ProjectActivityIdentitySchema, z.null()]),
    details: z.record(z.string(), z.string().nullable()),
    createdAt: z.iso.datetime(),
  })
  .openapi("ProjectActivity");

const PaginationSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .openapi("ProjectCollaborationPagination");

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const HistoryPaginationQuerySchema = z.object({
  historyPage: z.coerce.number().int().min(1).default(1),
  historyPageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const CandidateQuerySchema = PaginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

const AssignmentInputSchema = z.object({
  userId: z.string().min(1),
  responsibility: ProjectResponsibilitySchema,
});

const AddAssignmentsInputSchema = z
  .object({
    assignments: z.array(AssignmentInputSchema).min(1).max(100),
  })
  .openapi("AddProjectAssignmentsInput");

const UpdateAssignmentInputSchema = z
  .object({ responsibility: ProjectResponsibilitySchema })
  .openapi("UpdateProjectAssignmentInput");

const AssignmentListResponseSchema = z
  .object({
    active: z.array(ProjectAssignmentSchema),
    history: z.array(ProjectAssignmentSchema),
    historyPagination: PaginationSchema,
  })
  .openapi("ProjectAssignmentListResponse");

const AssignmentResponseSchema = z
  .object({ assignment: ProjectAssignmentSchema })
  .openapi("ProjectAssignmentResponse");

const AssignmentBatchResponseSchema = z
  .object({ assignments: z.array(ProjectAssignmentSchema) })
  .openapi("ProjectAssignmentBatchResponse");

const CandidateListResponseSchema = z
  .object({
    candidates: z.array(ProjectAssignmentCandidateSchema),
    pagination: PaginationSchema,
  })
  .openapi("ProjectAssignmentCandidateListResponse");

const ActivityListResponseSchema = z
  .object({
    activities: z.array(ProjectActivitySchema),
    pagination: PaginationSchema,
  })
  .openapi("ProjectActivityListResponse");

const RemovedMemberResponseSchema = z
  .object({
    member: z.object({ id: z.string(), userId: z.string(), name: z.string() }),
  })
  .openapi("RemovedTeamMemberResponse");

const CollaborationErrorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        "FORBIDDEN",
        "NOT_FOUND",
        "VALIDATION_ERROR",
        "CONFLICT",
        "LAST_OWNER",
        "PROJECT_ARCHIVED",
      ]),
      message: z.string(),
    }),
  })
  .openapi("ProjectCollaborationError");

const projectParams = z.object({ projectId: z.string().min(1) });
const assignmentParams = projectParams.extend({
  assignmentId: z.string().min(1),
});
const memberParams = z.object({ memberId: z.string().min(1) });
const security = [{ sessionCookie: [] }];

const protectedResponses = {
  ...rateLimitedErrorResponse,
  401: {
    description: "Authentication is required.",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  403: {
    description: "The active membership cannot perform this operation.",
    content: { "application/json": { schema: CollaborationErrorSchema } },
  },
  404: {
    description: "The requested project resource is unavailable.",
    content: { "application/json": { schema: CollaborationErrorSchema } },
  },
  409: {
    description: "An active organization is required or the write is stale.",
    content: {
      "application/json": {
        schema: z.union([
          OrganizationRequiredErrorSchema,
          CollaborationErrorSchema,
        ]),
      },
    },
  },
};

export const listProjectAssignmentsRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/assignments",
  operationId: "listProjectAssignments",
  tags: ["Project collaboration"],
  security,
  request: { params: projectParams, query: HistoryPaginationQuerySchema },
  responses: {
    200: {
      description: "Current and former project assignments.",
      content: { "application/json": { schema: AssignmentListResponseSchema } },
    },
    ...protectedResponses,
  },
});

export const listProjectAssignmentCandidatesRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/assignment-candidates",
  operationId: "listProjectAssignmentCandidates",
  tags: ["Project collaboration"],
  security,
  request: { params: projectParams, query: CandidateQuerySchema },
  responses: {
    200: {
      description: "Active studio members eligible for assignment.",
      content: { "application/json": { schema: CandidateListResponseSchema } },
    },
    ...protectedResponses,
  },
});

export const addProjectAssignmentsRoute = createRoute({
  method: "post",
  path: "/api/projects/{projectId}/assignments",
  operationId: "addProjectAssignments",
  tags: ["Project collaboration"],
  security,
  request: {
    params: projectParams,
    body: {
      required: true,
      content: { "application/json": { schema: AddAssignmentsInputSchema } },
    },
  },
  responses: {
    201: {
      description: "The created project assignments.",
      content: {
        "application/json": { schema: AssignmentBatchResponseSchema },
      },
    },
    400: {
      description: "Invalid assignment input.",
      content: { "application/json": { schema: CollaborationErrorSchema } },
    },
    ...protectedResponses,
  },
});

export const updateProjectAssignmentRoute = createRoute({
  method: "patch",
  path: "/api/projects/{projectId}/assignments/{assignmentId}",
  operationId: "updateProjectAssignment",
  tags: ["Project collaboration"],
  security,
  request: {
    params: assignmentParams,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateAssignmentInputSchema } },
    },
  },
  responses: {
    200: {
      description: "The assignment with its current responsibility.",
      content: { "application/json": { schema: AssignmentResponseSchema } },
    },
    400: {
      description: "Invalid responsibility.",
      content: { "application/json": { schema: CollaborationErrorSchema } },
    },
    ...protectedResponses,
  },
});

export const removeProjectAssignmentRoute = createRoute({
  method: "delete",
  path: "/api/projects/{projectId}/assignments/{assignmentId}",
  operationId: "removeProjectAssignment",
  tags: ["Project collaboration"],
  security,
  request: { params: assignmentParams },
  responses: {
    200: {
      description: "The ended assignment period.",
      content: { "application/json": { schema: AssignmentResponseSchema } },
    },
    ...protectedResponses,
  },
});

export const listProjectActivitiesRoute = createRoute({
  method: "get",
  path: "/api/projects/{projectId}/activities",
  operationId: "listProjectActivities",
  tags: ["Activity"],
  security,
  request: { params: projectParams, query: PaginationQuerySchema },
  responses: {
    200: {
      description: "Newest-first system activity for the project.",
      content: { "application/json": { schema: ActivityListResponseSchema } },
    },
    ...protectedResponses,
  },
});

export const removeTeamMemberRoute = createRoute({
  method: "delete",
  path: "/api/team/members/{memberId}",
  operationId: "removeTeamMember",
  tags: ["Team"],
  security,
  request: { params: memberParams },
  responses: {
    200: {
      description: "Member access revoked with project history preserved.",
      content: { "application/json": { schema: RemovedMemberResponseSchema } },
    },
    ...protectedResponses,
  },
});
