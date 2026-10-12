import {
  createIdentityService,
  type IdentityStore,
} from "../../src/identity/identity-service";
import type {
  StudioMemberRecord,
  UserProfileRecord,
} from "../../src/identity/identity-types";

export function createTestIdentityService() {
  const users: UserProfileRecord[] = [
    {
      id: "user-1",
      alias: "CRI",
      avatarColor: "#11182b",
      name: "Cristian Granda",
      email: "cristian@orbit.pe",
      image: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      id: "user-2",
      alias: "EXT",
      avatarColor: "#4657d9",
      name: "External User",
      email: "external@orbit.pe",
      image: null,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  ];
  const members: Array<StudioMemberRecord & { organizationId: string }> = [
    {
      memberId: "member-1",
      userId: "user-1",
      alias: "CRI",
      avatarColor: "#11182b",
      name: "Cristian Granda",
      email: "cristian@orbit.pe",
      image: null,
      role: "owner",
      position: null,
      memberSince: new Date("2026-01-01T00:00:00.000Z"),
      organizationId: "org-1",
    },
    {
      memberId: "member-2",
      userId: "user-2",
      alias: "EXT",
      avatarColor: "#4657d9",
      name: "External User",
      email: "external@orbit.pe",
      image: null,
      role: "member",
      position: "junior",
      memberSince: new Date("2026-01-02T00:00:00.000Z"),
      organizationId: "org-2",
    },
  ];
  const store: IdentityStore = {
    hasMembership: async (userId, organizationId) =>
      members.some(
        (member) =>
          member.userId === userId && member.organizationId === organizationId,
      ),
    findUser: async (userId) =>
      users.find((user) => user.id === userId) ?? null,
    updateProfile: async (userId, input) => {
      const index = users.findIndex((user) => user.id === userId);
      if (index === -1) return null;
      users[index] = { ...users[index], ...input };
      const memberIndex = members.findIndex(
        (member) => member.userId === userId,
      );
      if (memberIndex >= 0)
        members[memberIndex] = { ...members[memberIndex], ...input };
      return users[index];
    },
    listMembers: async (organizationId, { page, pageSize, q, position }) => {
      const normalizedSearch = q?.toLocaleLowerCase();
      const organizationMembers = members.filter(
        (member) =>
          member.organizationId === organizationId &&
          (!position || member.position === position) &&
          (!normalizedSearch ||
            [member.name, member.email, member.alias ?? ""].some((value) =>
              value.toLocaleLowerCase().includes(normalizedSearch),
            )),
      );
      return {
        members: organizationMembers.slice(
          (page - 1) * pageSize,
          page * pageSize,
        ),
        total: organizationMembers.length,
      };
    },
    findMember: async (organizationId, userId) =>
      members.find(
        (member) =>
          member.organizationId === organizationId && member.userId === userId,
      ) ?? null,
    getMembershipRole: async (userId, organizationId) =>
      members.find(
        (member) =>
          member.userId === userId && member.organizationId === organizationId,
      )?.role ?? null,
    updateMemberPosition: async (organizationId, memberId, position) => {
      const index = members.findIndex(
        (member) =>
          member.memberId === memberId &&
          member.organizationId === organizationId,
      );
      if (index === -1) return null;
      members[index] = { ...members[index]!, position };
      return members[index]!;
    },
  };
  return createIdentityService(store);
}

export const testIdentityService = createTestIdentityService();
