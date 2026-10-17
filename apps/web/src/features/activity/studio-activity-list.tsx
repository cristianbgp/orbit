import { Link } from "react-router-dom";

import { CaseActivityMessage } from "@/features/cases/case-activity-message";
import { CaseStatusBadge } from "@/features/cases/case-status-badge";
import { ProjectActivityMessage } from "@/features/projects/project-activity-message";
import { ProjectStatusBadge } from "@/features/projects/project-presentation";
import type { DashboardActivityPreview } from "@/lib/api/generated/models";

function formatActivityTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })
    .format(new Date(value))
    .replaceAll(".", "");
}

export function StudioActivityList({
  activities,
  timeZone,
}: {
  activities: DashboardActivityPreview[];
  timeZone: string;
}) {
  return (
    <ol className="divide-border divide-y">
      {activities.map((activity) => (
        <li key={activity.id} className="px-5 py-5 sm:px-6">
          <div className="text-foreground text-sm leading-6">
            {activity.source === "case" ? (
              <CaseActivityMessage activity={activity} />
            ) : activity.project ? (
              <ProjectActivityMessage
                activity={activity}
                projectId={activity.project.id}
              />
            ) : null}
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {activity.case ? (
              <Link
                className="text-primary-strong font-medium hover:underline"
                to={`/cases/${activity.case.id}`}
              >
                {activity.case.identification}
              </Link>
            ) : activity.project ? (
              <Link
                className="text-primary-strong font-medium hover:underline"
                to={`/projects/${activity.project.id}`}
              >
                {activity.project.name}
              </Link>
            ) : null}
            {activity.project?.archivedAt || activity.case?.archivedAt ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-semibold">
                Archivado
              </span>
            ) : activity.case &&
              !(
                activity.type === "case.updated" &&
                activity.details.previousStatus &&
                activity.details.newStatus
              ) ? (
              <CaseStatusBadge status={activity.case.status} />
            ) : activity.project &&
              activity.type !== "project.status_changed" &&
              activity.project.status !== "active" ? (
              <ProjectStatusBadge status={activity.project.status} />
            ) : null}
            <span aria-hidden="true">·</span>
            <time dateTime={activity.createdAt}>
              {formatActivityTime(activity.createdAt, timeZone)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
