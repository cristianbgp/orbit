import { PositionAvatarGroups } from "@/features/identity/position-avatar-groups";
import type { TaskResponsible } from "@/lib/api/generated/models";

export function ProjectTaskResponsibleGroups({
  responsibles,
}: {
  responsibles: readonly TaskResponsible[];
}) {
  return (
    <PositionAvatarGroups
      ariaLabel="Encargados de la tarea"
      emptyLabel="Sin encargados asignados"
      people={responsibles.map((responsible) => ({
        identityId: responsible.assignmentId,
        userId: responsible.userId,
        alias: responsible.userAlias,
        fullName: responsible.userName,
        avatarColor: responsible.userAvatarColor,
        position: responsible.userPosition,
        activeStudioMember: responsible.activeStudioMember,
        contextualRole: "Encargado",
      }))}
    />
  );
}
