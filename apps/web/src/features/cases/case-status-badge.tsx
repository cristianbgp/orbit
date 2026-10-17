import { cn } from "@/lib/utils";
import { getCaseLabel } from "./case-presenters";

export function CaseStatusBadge({ status }: { status: string }) {
  const known = status === "in_progress" || status === "concluded";
  return (
    <span
      data-case-status={status}
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "in_progress" && "bg-info-soft text-primary-strong",
        status === "concluded" && "bg-success-soft text-success",
        !known && "bg-muted text-muted-foreground",
      )}
    >
      {known ? getCaseLabel("status", status) : "Estado desconocido"}
    </span>
  );
}
