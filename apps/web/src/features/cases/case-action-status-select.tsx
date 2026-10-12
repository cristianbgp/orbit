import { CircleCheckBig, Clock3 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CaseActionEntryStatus } from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";

const labels = {
  pending: "Pendiente",
  completed: "Completada",
} satisfies Record<CaseActionEntryStatus, string>;

const styles = {
  pending: "border-transparent bg-muted text-task-status-pending",
  completed: "border-transparent bg-success-soft text-task-status-completed",
} satisfies Record<CaseActionEntryStatus, string>;

const icons = {
  pending: Clock3,
  completed: CircleCheckBig,
};

export function CaseActionStatusSelect({
  actionTitle,
  value,
  disabled = false,
  display = "label",
  onValueChange,
  className,
}: {
  actionTitle: string;
  value: CaseActionEntryStatus;
  disabled?: boolean;
  display?: "label" | "icon";
  onValueChange(status: CaseActionEntryStatus): void;
  className?: string;
}) {
  const Icon = icons[value];
  const iconOnly = display === "icon";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== value) onValueChange(next as CaseActionEntryStatus);
      }}
    >
      <SelectTrigger
        size="sm"
        showChevron={!iconOnly}
        aria-label={`Cambiar estado de ${actionTitle}. Estado actual: ${labels[value]}`}
        className={cn(
          "rounded-full text-xs font-semibold shadow-none",
          iconOnly
            ? "!size-11 justify-center gap-0 p-0 lg:!size-8"
            : "h-8 px-2.5",
          styles[value],
          className,
        )}
      >
        {iconOnly ? (
          <Icon aria-hidden="true" className="size-4 text-current" />
        ) : (
          <>
            <Icon aria-hidden="true" className="size-3.5 text-current" />
            <SelectValue />
          </>
        )}
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {(Object.keys(labels) as CaseActionEntryStatus[]).map((status) => (
          <SelectItem key={status} value={status}>
            {labels[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
