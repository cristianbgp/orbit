import {
  isValidUserAlias,
  normalizeUserAlias,
  resolveUserAlias,
} from "./user-alias";
import {
  LEGACY_AVATAR_COLORS,
  avatarColorForUserId,
  isValidAvatarColor,
  normalizeAvatarColor,
  type AvatarColor,
} from "./avatar-color";
import type {
  IdentityActor,
  StudioMemberProfile,
  StudioMemberRecord,
  UserProfileRecord,
} from "./identity-types";
import {
  isStudioMemberPosition,
  type StudioMemberPosition,
} from "./studio-member-position";

export type IdentityStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  findUser(userId: string): Promise<UserProfileRecord | null>;
  updateProfile(
    userId: string,
    input: { alias?: string; avatarColor?: string },
  ): Promise<UserProfileRecord | null>;
  listMembers(
    organizationId: string,
    input: {
      page: number;
      pageSize: number;
      q?: string;
      position?: StudioMemberPosition;
    },
  ): Promise<{ members: StudioMemberRecord[]; total: number }>;
  findMember(
    organizationId: string,
    userId: string,
  ): Promise<StudioMemberRecord | null>;
  getMembershipRole(
    userId: string,
    organizationId: string,
  ): Promise<string | null>;
  updateMemberPosition(
    organizationId: string,
    memberId: string,
    position: StudioMemberPosition,
  ): Promise<StudioMemberRecord | null>;
};

export type IdentityServiceErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR";

export class IdentityServiceError extends Error {
  readonly code: IdentityServiceErrorCode;

  constructor(code: IdentityServiceErrorCode, message: string) {
    super(message);
    this.name = "IdentityServiceError";
    this.code = code;
  }
}

type MemberListInput = {
  page?: number;
  pageSize?: number;
  q?: string;
  position?: StudioMemberPosition;
};

function withCurrentUser(
  member: StudioMemberRecord,
  actor: IdentityActor,
): StudioMemberProfile {
  return {
    ...member,
    alias: resolveUserAlias(member.alias, member.name),
    avatarColor: resolveAvatarColor(member.avatarColor, member.userId),
    isCurrentUser: member.userId === actor.userId,
  };
}

function resolveAvatarColor(value: string | null, userId: string): AvatarColor {
  const normalized = value ? normalizeAvatarColor(value) : "";
  return isValidAvatarColor(normalized)
    ? normalized
    : (avatarColorForUserId(userId, LEGACY_AVATAR_COLORS) as AvatarColor);
}

function withResolvedUser(user: UserProfileRecord) {
  return {
    ...user,
    alias: resolveUserAlias(user.alias, user.name),
    avatarColor: resolveAvatarColor(user.avatarColor, user.id),
  };
}

export function createIdentityService(store: IdentityStore) {
  async function assertMembership(actor: IdentityActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
      throw new IdentityServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    }
  }

  return {
    async getCurrentUser(userId: string) {
      const user = await store.findUser(userId);
      if (!user) {
        throw new IdentityServiceError("NOT_FOUND", "Usuario no encontrado.");
      }
      return withResolvedUser(user);
    },

    async updateCurrentUser(
      userId: string,
      input: { alias?: string; avatarColor?: string },
    ) {
      const update: { alias?: string; avatarColor?: string } = {};
      if (input.alias !== undefined) {
        const normalizedAlias = normalizeUserAlias(input.alias);
        if (!isValidUserAlias(normalizedAlias)) {
          throw new IdentityServiceError(
            "VALIDATION_ERROR",
            "El alias debe tener entre 2 y 12 letras o números.",
          );
        }
        update.alias = normalizedAlias;
      }
      if (input.avatarColor !== undefined) {
        const normalizedColor = normalizeAvatarColor(input.avatarColor);
        if (!isValidAvatarColor(normalizedColor)) {
          throw new IdentityServiceError(
            "VALIDATION_ERROR",
            "Selecciona un color disponible en la paleta de Orbit.",
          );
        }
        update.avatarColor = normalizedColor;
      }
      if (Object.keys(update).length === 0) {
        throw new IdentityServiceError(
          "VALIDATION_ERROR",
          "Envía al menos un cambio de perfil.",
        );
      }
      const user = await store.updateProfile(userId, update);
      if (!user) {
        throw new IdentityServiceError("NOT_FOUND", "Usuario no encontrado.");
      }
      return withResolvedUser(user);
    },

    async listMembers(actor: IdentityActor, input: MemberListInput) {
      await assertMembership(actor);
      const page = input.page ?? 1;
      const pageSize = Math.min(input.pageSize ?? 25, 100);
      const q = input.q?.trim();
      const result = await store.listMembers(actor.organizationId, {
        page,
        pageSize,
        ...(q ? { q } : {}),
        ...(input.position ? { position: input.position } : {}),
      });
      return {
        members: result.members.map((member) => withCurrentUser(member, actor)),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages:
            result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async getMember(actor: IdentityActor, userId: string) {
      await assertMembership(actor);
      const member = await store.findMember(actor.organizationId, userId);
      if (!member) {
        throw new IdentityServiceError("NOT_FOUND", "Miembro no encontrado.");
      }
      return withCurrentUser(member, actor);
    },

    async updateMemberPosition(
      actor: IdentityActor,
      memberId: string,
      position: StudioMemberPosition,
    ) {
      const role = await store.getMembershipRole(
        actor.userId,
        actor.organizationId,
      );
      if (role !== "owner") {
        throw new IdentityServiceError(
          "FORBIDDEN",
          "Solo el propietario puede cambiar la posición del equipo.",
        );
      }
      if (!isStudioMemberPosition(position)) {
        throw new IdentityServiceError(
          "VALIDATION_ERROR",
          "Selecciona una posición válida.",
        );
      }
      const member = await store.updateMemberPosition(
        actor.organizationId,
        memberId,
        position,
      );
      if (!member) {
        throw new IdentityServiceError("NOT_FOUND", "Miembro no encontrado.");
      }
      return withCurrentUser(member, actor);
    },
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;
