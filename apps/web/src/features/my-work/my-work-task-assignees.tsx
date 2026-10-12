import { PositionAvatarGroups } from "@/features/identity/position-avatar-groups";

type TaskAssignee = {
  assignmentId: string;
  userId: string | null;
  userName: string;
  userAlias: string;
  userAvatarColor: string | null;
  userPosition: "partner" | "senior" | "junior" | "assistant" | "intern" | null;
  activeStudioMember: boolean;
};

export function MyWorkTaskAssignees({
  responsibles,
}: {
  responsibles: readonly TaskAssignee[];
}) {
  return (
    <PositionAvatarGroups
      ariaLabel="Encargados de la tarea"
      emptyLabel="Sin encargado"
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
