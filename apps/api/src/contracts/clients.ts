import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";

export const ClientTypeSchema = z
  .enum(["person", "company"])
  .openapi("ClientType");

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional();

export const ClientInputSchema = z
  .object({
    type: ClientTypeSchema,
    name: z.string().trim().min(2).max(160),
    documentType: optionalText(30),
    documentNumber: optionalText(30),
    email: z.union([z.email().max(254), z.literal("")]).optional(),
    phone: optionalText(40),
    address: optionalText(300),
    notes: optionalText(2_000),
  })
  .openapi("ClientInput");

export const ClientUpdateSchema = ClientInputSchema.partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one client field is required",
  })
  .openapi("ClientUpdate");

export const ClientSchema = z
  .object({
    id: z.string(),
    type: ClientTypeSchema,
    name: z.string(),
    documentType: z.string().nullable(),
    documentNumber: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Client");

const ClientResponseSchema = z
  .object({ client: ClientSchema })
  .openapi("ClientResponse");

const ClientPaginationSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .openapi("ClientPagination");

const ClientListResponseSchema = z
  .object({
    clients: z.array(ClientSchema),
    pagination: ClientPaginationSchema,
  })
  .openapi("ClientListResponse");

const authErrors = {
  ...rateLimitedErrorResponse,
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
} as const;

export const listClientsRoute = createRoute({
  method: "get",
  path: "/api/clients",
  operationId: "listClients",
  tags: ["Clients"],
  security: [{ sessionCookie: [] }],
  request: {
    query: z.object({
      search: z.string().trim().max(160).optional(),
      type: ClientTypeSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
  },
  responses: {
    200: {
      description: "Clients in the active organization.",
      content: { "application/json": { schema: ClientListResponseSchema } },
    },
    400: {
      description: "The query is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

export const createClientRoute = createRoute({
  method: "post",
  path: "/api/clients",
  operationId: "createClient",
  tags: ["Clients"],
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ClientInputSchema } },
    },
  },
  responses: {
    201: {
      description: "The created client.",
      content: { "application/json": { schema: ClientResponseSchema } },
    },
    400: {
      description: "The client input is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...authErrors,
  },
});

const clientParams = z.object({ clientId: z.string().min(1) });

export const getClientRoute = createRoute({
  method: "get",
  path: "/api/clients/{clientId}",
  operationId: "getClient",
  tags: ["Clients"],
  security: [{ sessionCookie: [] }],
  request: { params: clientParams },
  responses: {
    200: {
      description: "One client in the active organization.",
      content: { "application/json": { schema: ClientResponseSchema } },
    },
    404: {
      description: "The client does not exist in the active organization.",
      content: { "application/json": { schema: NotFoundErrorSchema } },
    },
    ...authErrors,
  },
});

export const updateClientRoute = createRoute({
  method: "patch",
  path: "/api/clients/{clientId}",
  operationId: "updateClient",
  tags: ["Clients"],
  security: [{ sessionCookie: [] }],
  request: {
    params: clientParams,
    body: {
      required: true,
      content: { "application/json": { schema: ClientUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated client.",
      content: { "application/json": { schema: ClientResponseSchema } },
    },
    400: {
      description: "The client update is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    404: {
      description: "The client does not exist in the active organization.",
      content: { "application/json": { schema: NotFoundErrorSchema } },
    },
    ...authErrors,
  },
});
