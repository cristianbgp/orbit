import { describe, expect, test, vi } from "vitest";

import {
  createIdentityService,
  type IdentityStore,
} from "../src/identity/identity-service";
import type {
  StudioMemberRecord,
  UserProfileRecord,
} from "../src/identity/identity-types";

const users: UserProfileRecord[] = [
  {
    id: "user-1",
    alias: "CGP",
    avatarColor: "#11182b",
    name: "Cristian Granda",
    email: "cristian@orbit.pe",
    image: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const members: StudioMemberRecord[] = [
  {
    memberId: "member-1",
    userId: "user-1",
    alias: "CGP",
    avatarColor: "#11182b",
    name: "Cristian Granda",
    email: "cristian@orbit.pe",
    image: null,
    role: "owner",
    position: null,
    memberSince: new Date("2026-01-01T00:00:00.000Z"),
  },
];

function createStore(overrides: Partial<IdentityStore> = {}) {
  const store: IdentityStore = {
    hasMembership: async () => true,
    findUser: async (userId) =>
      users.find((user) => user.id === userId) ?? null,
    updateProfile: vi.fn(async (userId, input) => {
      const user = users.find((candidate) => candidate.id === userId);
      return user ? { ...user, ...input } : null;
    }),
    listMembers: vi.fn(async () => ({ members, total: members.length })),
    findMember: vi.fn(async (organizationId, userId) =>
      organizationId === "org-1"
        ? (members.find((member) => member.userId === userId) ?? null)
        : null,
    ),
    getMembershipRole: vi.fn(async () => "owner"),
    updateMemberPosition: vi.fn(
      async (_organizationId, _memberId, position) => ({
        ...members[0]!,
        position,
      }),
    ),
    ...overrides,
  };
  return store;
}

describe("identity service", () => {
  test("normalizes member search and forwards the position filter", async () => {
    const listMembers = vi.fn(async () => ({ members, total: 1 }));
    const service = createIdentityService(createStore({ listMembers }));

    await service.listMembers(
      { userId: "user-1", organizationId: "org-1" },
      { page: 2, pageSize: 10, q: "  cristian  ", position: "partner" },
    );

    expect(listMembers).toHaveBeenCalledWith("org-1", {
      page: 2,
      pageSize: 10,
      q: "cristian",
      position: "partner",
    });
  });

  test("lets an owner update a tenant member professional position", async () => {
    const updateMemberPosition = vi.fn(async () => ({
      ...members[0]!,
      position: "senior" as const,
    }));
    const store = Object.assign(createStore(), {
      getMembershipRole: vi.fn(async () => "owner"),
      updateMemberPosition,
    });
    const service = createIdentityService(store) as ReturnType<
      typeof createIdentityService
    > & {
      updateMemberPosition(
        actor: { userId: string; organizationId: string },
        memberId: string,
        position: string,
      ): Promise<StudioMemberRecord & { position: string }>;
    };

    await expect(
      service.updateMemberPosition(
        { userId: "user-1", organizationId: "org-1" },
        "member-1",
        "senior",
      ),
    ).resolves.toMatchObject({ memberId: "member-1", position: "senior" });
    expect(updateMemberPosition).toHaveBeenCalledWith(
      "org-1",
      "member-1",
      "senior",
    );
  });

  test("rejects position updates from non-owners", async () => {
    const updateMemberPosition = vi.fn();
    const store = Object.assign(createStore(), {
      getMembershipRole: vi.fn(async () => "member"),
      updateMemberPosition,
    });
    const service = createIdentityService(store) as ReturnType<
      typeof createIdentityService
    > & {
      updateMemberPosition(...args: unknown[]): Promise<unknown>;
    };

    await expect(
      service.updateMemberPosition(
        { userId: "user-1", organizationId: "org-1" },
        "member-1",
        "partner",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateMemberPosition).not.toHaveBeenCalled();
  });

  test("hides missing and cross-tenant position targets", async () => {
    const store = Object.assign(createStore(), {
      getMembershipRole: vi.fn(async () => "owner"),
      updateMemberPosition: vi.fn(async () => null),
    });
    const service = createIdentityService(store) as ReturnType<
      typeof createIdentityService
    > & {
      updateMemberPosition(...args: unknown[]): Promise<unknown>;
    };

    await expect(
      service.updateMemberPosition(
        { userId: "user-1", organizationId: "org-1" },
        "member-outside",
        "junior",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects values outside the professional position catalog", async () => {
    const store = Object.assign(createStore(), {
      getMembershipRole: vi.fn(async () => "owner"),
      updateMemberPosition: vi.fn(),
    });
    const service = createIdentityService(store) as ReturnType<
      typeof createIdentityService
    > & {
      updateMemberPosition(...args: unknown[]): Promise<unknown>;
    };

    await expect(
      service.updateMemberPosition(
        { userId: "user-1", organizationId: "org-1" },
        "member-1",
        "director",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("normalizes and updates only the authenticated user's alias", async () => {
    const store = createStore();
    const service = createIdentityService(store);

    await expect(
      service.updateCurrentUser("user-1", { alias: "  Cris  " }),
    ).resolves.toEqual(
      expect.objectContaining({ id: "user-1", alias: "Cris" }),
    );
    expect(store.updateProfile).toHaveBeenCalledWith("user-1", {
      alias: "Cris",
    });
  });

  test("normalizes and updates the authenticated user's palette color", async () => {
    const store = createStore();
    const service = createIdentityService(store);

    await expect(
      service.updateCurrentUser("user-1", { avatarColor: " #4657D9 " }),
    ).resolves.toMatchObject({ id: "user-1", avatarColor: "#4657d9" });
    expect(store.updateProfile).toHaveBeenCalledWith("user-1", {
      avatarColor: "#4657d9",
    });
  });

  test("rejects colors outside the Orbit palette", async () => {
    const store = createStore();
    const service = createIdentityService(store);

    await expect(
      service.updateCurrentUser("user-1", { avatarColor: "#ffffff" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(store.updateProfile).not.toHaveBeenCalled();
  });

  test.each(["C", "A B", "A-B", "ABCDEFGHIJKLM"])(
    "rejects invalid alias %s",
    async (alias) => {
      const service = createIdentityService(createStore());

      await expect(
        service.updateCurrentUser("user-1", { alias }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    },
  );

  test("reports a missing current user as not found", async () => {
    const service = createIdentityService(createStore());

    await expect(service.getCurrentUser("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("resolves deterministic valid aliases when nullable storage has not been backfilled", async () => {
    const userWithoutAlias = { ...users[0]!, alias: null, avatarColor: null };
    const memberWithoutAlias = {
      ...members[0]!,
      alias: null,
      avatarColor: null,
    };
    const service = createIdentityService(
      createStore({
        findUser: async () => userWithoutAlias,
        listMembers: async () => ({ members: [memberWithoutAlias], total: 1 }),
        findMember: async () => memberWithoutAlias,
      }),
    );
    const actor = { userId: "user-1", organizationId: "org-1" };

    await expect(service.getCurrentUser("user-1")).resolves.toMatchObject({
      alias: "CG",
      avatarColor: "#11182b",
    });
    await expect(service.listMembers(actor, {})).resolves.toMatchObject({
      members: [expect.objectContaining({ alias: "CG" })],
    });
    await expect(service.getMember(actor, "user-1")).resolves.toMatchObject({
      alias: "CG",
    });
  });

  test("uses default pagination when listing members", async () => {
    const store = createStore();
    const service = createIdentityService(store);

    await expect(
      service.listMembers({ userId: "user-1", organizationId: "org-1" }, {}),
    ).resolves.toMatchObject({
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });
    expect(store.listMembers).toHaveBeenCalledWith("org-1", {
      page: 1,
      pageSize: 25,
    });
  });

  test("derives current-user membership from the actor", async () => {
    const service = createIdentityService(createStore());

    await expect(
      service.listMembers({ userId: "user-1", organizationId: "org-1" }, {}),
    ).resolves.toMatchObject({
      members: [
        expect.objectContaining({ userId: "user-1", isCurrentUser: true }),
      ],
    });
  });

  test("rejects directory reads when the actor is no longer a member", async () => {
    const store = {
      ...createStore(),
      hasMembership: vi.fn(async () => false),
    };
    const service = createIdentityService(store);
    const actor = { userId: "user-1", organizationId: "org-1" };

    await expect(service.listMembers(actor, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(service.getMember(actor, "user-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(store.listMembers).not.toHaveBeenCalled();
    expect(store.findMember).not.toHaveBeenCalled();
  });

  test("does not expose a member outside the actor organization", async () => {
    const store = createStore({
      findMember: async () => null,
    });
    const service = createIdentityService(store);

    await expect(
      service.getMember({ userId: "actor", organizationId: "org-1" }, "user-2"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
