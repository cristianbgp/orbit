import type { PendingTeamInvitation, TeamActor } from "./team-invitation-types";

export type TeamInvitationStore = {
  getMembershipRole(
    userId: string,
    organizationId: string,
  ): Promise<string | null>;
  listPending(organizationId: string): Promise<PendingTeamInvitation[]>;
};

export class TeamInvitationServiceError extends Error {
  constructor(
    readonly code: "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "TeamInvitationServiceError";
  }
}

export type TeamInvitationService = ReturnType<
  typeof createTeamInvitationService
>;

export function createTeamInvitationService(store: TeamInvitationStore) {
  return {
    async listPending(actor: TeamActor) {
      const role = await store.getMembershipRole(
        actor.userId,
        actor.organizationId,
      );

      if (role !== "owner") {
        throw new TeamInvitationServiceError(
          "FORBIDDEN",
          "No puedes ver las invitaciones de este estudio.",
        );
      }

      return store.listPending(actor.organizationId);
    },
  };
}
