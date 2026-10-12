import { createRoute, z } from "@hono/zod-openapi";

import {
  ForbiddenErrorSchema,
  OrganizationRequiredErrorSchema,
  rateLimitedErrorResponse,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./common";
import {
  isValidUserAlias,
  normalizeUserAlias,
  USER_ALIAS_MAX_LENGTH,
  USER_ALIAS_MIN_LENGTH,
  USER_ALIAS_PATTERN_SOURCE,
} from "../identity/user-alias";
import {
  isValidAvatarColor,
  normalizeAvatarColor,
} from "../identity/avatar-color";
import { STUDIO_MEMBER_POSITIONS } from "../identity/studio-member-position";

export const StudioMemberPositionSchema = z
  .enum(STUDIO_MEMBER_POSITIONS)
  .openapi("StudioMemberPosition");

export const NullableStudioMemberPositionSchema = z
  .enum(STUDIO_MEMBER_POSITIONS)
  .nullable()
  .openapi("NullableStudioMemberPosition");

export const AvatarColorSchema = z
  .string()
  .transform(normalizeAvatarColor)
  .refine((value): boolean => isValidAvatarColor(value))
  .openapi("AvatarColor", {
    type: "string",
    pattern: "^#[0-9a-f]{6}$",
    example: "#4657d9",
  });

export const NullableAvatarColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/)
  .nullable();

export const UserAliasSchema = z
  .string()
  .transform(normalizeUserAlias)
  .refine(isValidUserAlias)
  .openapi("UserAlias", {
    type: "string",
    minLength: USER_ALIAS_MIN_LENGTH,
    maxLength: USER_ALIAS_MAX_LENGTH,
    pattern: USER_ALIAS_PATTERN_SOURCE,
  });

export const UserProfileSchema = z
  .object({
    id: z.string(),
    alias: UserAliasSchema,
    avatarColor: AvatarColorSchema,
    name: z.string(),
    email: z.email(),
    image: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("UserProfile");

export const StudioMemberSchema = z
  .object({
    memberId: z.string(),
    userId: z.string(),
    alias: UserAliasSchema,
    avatarColor: AvatarColorSchema,
    name: z.string(),
    email: z.email(),
    image: z.string().nullable(),
    role: z.string(),
    position: NullableStudioMemberPositionSchema,
    memberSince: z.iso.datetime(),
    isCurrentUser: z.boolean(),
  })
  .openapi("StudioMember");

const CurrentUserResponseSchema = z
  .object({ user: UserProfileSchema })
  .openapi("CurrentUser");

const MemberResponseSchema = z
  .object({ member: StudioMemberSchema })
  .openapi("StudioMemberResponse");

const MemberPaginationSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .openapi("StudioMemberPagination");

const MemberListResponseSchema = z
  .object({
    members: z.array(StudioMemberSchema),
    pagination: MemberPaginationSchema,
  })
  .openapi("StudioMemberListResponse");

const MemberNotFoundErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("NOT_FOUND"),
      message: z.literal("Miembro no encontrado."),
    }),
  })
  .openapi("StudioMemberNotFoundError");

const UserNotFoundErrorSchema = z
  .object({
    error: z.object({
      code: z.literal("NOT_FOUND"),
      message: z.literal("Usuario no encontrado."),
    }),
  })
  .openapi("UserProfileNotFoundError");

const organizationErrors = {
  ...rateLimitedErrorResponse,
  401: {
    description: "Authentication is required.",
    content: { "application/json": { schema: UnauthorizedErrorSchema } },
  },
  409: {
    description: "An active organization is required.",
    content: {
      "application/json": { schema: OrganizationRequiredErrorSchema },
    },
  },
  403: {
    description: "The user is not a member of the active organization.",
    content: { "application/json": { schema: ForbiddenErrorSchema } },
  },
} as const;

export const currentUserRoute = createRoute({
  method: "get",
  path: "/api/me",
  operationId: "getCurrentUser",
  tags: ["Identity"],
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "The authenticated user's public identity.",
      content: { "application/json": { schema: CurrentUserResponseSchema } },
    },
    401: {
      description: "Authentication is required.",
      content: { "application/json": { schema: UnauthorizedErrorSchema } },
    },
    404: {
      description: "The authenticated user no longer exists.",
      content: { "application/json": { schema: UserNotFoundErrorSchema } },
    },
    429: rateLimitedErrorResponse[429],
  },
});

export const updateCurrentUserRoute = createRoute({
  method: "patch",
  path: "/api/me",
  operationId: "updateCurrentUser",
  tags: ["Identity"],
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              alias: UserAliasSchema.optional(),
              avatarColor: AvatarColorSchema.optional(),
            })
            .refine(
              (input) =>
                input.alias !== undefined || input.avatarColor !== undefined,
            ),
        },
      },
    },
  },
  responses: {
    200: {
      description: "The updated authenticated user profile.",
      content: { "application/json": { schema: CurrentUserResponseSchema } },
    },
    400: {
      description: "The alias is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    401: {
      description: "Authentication is required.",
      content: { "application/json": { schema: UnauthorizedErrorSchema } },
    },
    404: {
      description: "The authenticated user no longer exists.",
      content: { "application/json": { schema: UserNotFoundErrorSchema } },
    },
    429: rateLimitedErrorResponse[429],
  },
});

export const listTeamMembersRoute = createRoute({
  method: "get",
  path: "/api/team/members",
  operationId: "listTeamMembers",
  tags: ["Team"],
  security: [{ sessionCookie: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      q: z.string().trim().max(100).optional(),
      position: StudioMemberPositionSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Members in the active organization.",
      content: { "application/json": { schema: MemberListResponseSchema } },
    },
    400: {
      description: "The member pagination is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    ...organizationErrors,
  },
});

export const getTeamMemberRoute = createRoute({
  method: "get",
  path: "/api/team/users/{userId}",
  operationId: "getTeamMember",
  tags: ["Team"],
  security: [{ sessionCookie: [] }],
  request: { params: z.object({ userId: z.string().min(1) }) },
  responses: {
    200: {
      description: "One member in the active organization.",
      content: { "application/json": { schema: MemberResponseSchema } },
    },
    404: {
      description: "The member does not exist in the active organization.",
      content: { "application/json": { schema: MemberNotFoundErrorSchema } },
    },
    ...organizationErrors,
  },
});

export const updateTeamMemberPositionRoute = createRoute({
  method: "patch",
  path: "/api/team/members/{memberId}/position",
  operationId: "updateTeamMemberPosition",
  tags: ["Team"],
  security: [{ sessionCookie: [] }],
  request: {
    params: z.object({ memberId: z.string().min(1) }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ position: StudioMemberPositionSchema }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "The membership with its updated professional position.",
      content: { "application/json": { schema: MemberResponseSchema } },
    },
    400: {
      description: "The professional position is invalid.",
      content: { "application/json": { schema: ValidationErrorSchema } },
    },
    404: {
      description: "The member does not exist in the active organization.",
      content: { "application/json": { schema: MemberNotFoundErrorSchema } },
    },
    ...organizationErrors,
  },
});
