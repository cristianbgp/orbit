import { PositionAvatarGroups } from "@/features/identity/position-avatar-groups";
import type { ProjectTeamSummary } from "@/lib/api/generated/models";

export function ProjectTeamAvatars({
  projectName,
  team,
}: {
  projectName: string;
  team: ProjectTeamSummary;
}) {
  return (
    <PositionAvatarGroups
      ariaLabel={`Equipo de ${projectName}`}
      emptyLabel="Sin equipo"
      size="sm"
      people={team.members.map((member) => ({
        identityId: member.userId,
        userId: member.userId,
        alias: member.alias,
        fullName: member.fullName,
        avatarColor: member.avatarColor,
        position: member.position,
        activeStudioMember: true,
        contextualRole:
          member.responsibility === "responsible" ? "Supervisor" : "Miembro",
      }))}
    />
  );
}
