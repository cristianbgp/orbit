import { projectActivity } from "../db/project-collaboration-schema";

export type ProjectActivityActor = { userId: string; name: string };

export function projectActivityValues(input: {
  id: string;
  organizationId: string;
  projectId: string;
  type: string;
  actor: ProjectActivityActor;
  subject?: { userId: string; name: string };
  details: Record<string, string | null>;
  createdAt?: Date;
}): typeof projectActivity.$inferInsert {
  return {
    id: input.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    type: input.type,
    actorUserId: input.actor.userId,
    actorNameSnapshot: input.actor.name,
    subjectUserId: input.subject?.userId ?? null,
    subjectNameSnapshot: input.subject?.name ?? null,
    details: input.details,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  };
}
