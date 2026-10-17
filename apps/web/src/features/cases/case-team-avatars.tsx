import { PositionAvatarGroups } from "@/features/identity/position-avatar-groups";
import type { LegalCaseTeam } from "@/lib/api/generated/models";

export function CaseTeamAvatars({
  caseName,
  team,
  kind = "team",
  scrollable = true,
}: {
  caseName: string;
  team: LegalCaseTeam;
  kind?: "team" | "followers";
  scrollable?: boolean;
}) {
  const following = kind === "followers";
  return (
    <PositionAvatarGroups
      ariaLabel={`${following ? "Seguimiento" : "Equipo"} de ${caseName}`}
      emptyLabel={following ? "Sin seguimiento" : "Sin equipo"}
      size="sm"
      scrollable={scrollable}
      people={team.members.map((member) => ({
        identityId: member.userId,
        userId: member.userId,
        alias: member.alias,
        fullName: member.fullName,
        avatarColor: member.avatarColor,
        position: member.position,
        activeStudioMember: true,
        contextualRole: following ? "Seguimiento" : "Miembro",
      }))}
    />
  );
}
