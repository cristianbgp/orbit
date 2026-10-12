import { createRoute, z } from "@hono/zod-openapi";

import { ClientTypeSchema } from "./clients";
import { CaseStatusSchema, CaseTypeSchema } from "./cases";
import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";
import { ProjectTaskStatusSchema } from "./project-tasks";
import { ProjectStatusSchema } from "./projects";
import { AvatarColorSchema } from "./identity";

const SearchClientSummarySchema = z
  .object({ id: z.string(), name: z.string() })
  .openapi("SearchClientSummary");

const SearchProjectSummarySchema = z
  .object({ id: z.string(), name: z.string() })
  .openapi("SearchProjectSummary");

const SearchStageSummarySchema = z
  .object({ id: z.string(), name: z.string() })
  .openapi("SearchStageSummary");

export const ProjectSearchResultSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: ProjectStatusSchema,
    client: SearchClientSummarySchema,
  })
  .openapi("ProjectSearchResult");

export const CaseSearchResultSchema = z
  .object({
    id: z.string(),
    identification: z.string(),
    status: CaseStatusSchema,
    type: CaseTypeSchema.nullable(),
    client: SearchClientSummarySchema,
  })
  .openapi("CaseSearchResult");

export const TaskSearchResultSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: ProjectTaskStatusSchema,
    project: SearchProjectSummarySchema,
    client: SearchClientSummarySchema,
    stage: SearchStageSummarySchema,
  })
  .openapi("TaskSearchResult");

export const ClientSearchResultSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: ClientTypeSchema,
    documentNumber: z.string().nullable(),
  })
  .openapi("ClientSearchResult");

export const MemberSearchResultSchema = z
  .object({
    userId: z.string(),
    alias: z.string(),
    avatarColor: AvatarColorSchema,
    name: z.string(),
    email: z.string(),
    role: z.string(),
  })
  .openapi("MemberSearchResult");

export const GlobalSearchResponseSchema = z
  .object({
    cases: z.array(CaseSearchResultSchema),
    projects: z.array(ProjectSearchResultSchema),
    tasks: z.array(TaskSearchResultSchema),
    clients: z.array(ClientSearchResultSchema),
    members: z.array(MemberSearchResultSchema),
  })
  .openapi("GlobalSearchResponse");

export const searchGloballyRoute = createRoute({
  method: "get",
  path: "/api/search",
  operationId: "searchGlobally",
  tags: ["Search"],
  security: [{ sessionCookie: [] }],
  request: {
    query: z.object({
      q: z.string().trim().min(2).max(160),
      limit: z.coerce.number().int().min(1).max(10).default(5),
    }),
  },
  responses: {
    200: {
      description: "Grouped search results in the active organization.",
      content: {
        "application/json": { schema: GlobalSearchResponseSchema },
      },
    },
    400: {
      description: "The search query is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
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
