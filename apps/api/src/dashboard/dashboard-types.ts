import type { ProjectActivityIdentityRecord } from "../project-collaboration/project-collaboration-types";

export type DashboardActor = {
  userId: string;
  organizationId: string;
};

type DashboardActivityBase = {
  id: string;
  organizationId: string;
  type: string;
  actor: ProjectActivityIdentityRecord;
  subject: ProjectActivityIdentityRecord | null;
  details: Record<string, string | null>;
  createdAt: Date;
};

export type DashboardActivityPreview = DashboardActivityBase &
  (
    | {
        source: "project";
        projectId: string;
        project: {
          id: string;
          name: string;
          status: "draft" | "active" | "completed";
          archivedAt: Date | null;
        };
        case: null;
      }
    | {
        source: "case";
        projectId: null;
        project: null;
        case: {
          id: string;
          identification: string;
          status: "in_progress" | "concluded";
          archivedAt: Date | null;
        };
      }
  );

export type DashboardActivityCursor = {
  createdAt: Date;
  id: string;
};

export type DashboardActivityStorePage = {
  activities: DashboardActivityPreview[];
  hasMore: boolean;
};

export type DashboardActivityPage = {
  timeZone: string;
  activities: DashboardActivityPreview[];
  nextCursor: string | null;
};
