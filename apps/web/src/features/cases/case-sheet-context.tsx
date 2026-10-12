import { Link } from "react-router-dom";

export type CaseSheetContextValue = {
  caseId: string;
  caseName: string;
  clientName: string;
};

export function CaseSheetContext({
  value,
  onNavigate,
}: {
  value: CaseSheetContextValue;
  onNavigate(): void;
}) {
  return (
    <div
      role="region"
      aria-label="Contexto del caso"
      className="rounded-control border-border bg-muted/40 mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border px-3 py-2.5 text-sm"
    >
      <Link
        to={`/cases/${value.caseId}`}
        className="text-primary focus-visible:ring-ring min-w-0 truncate font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        onClick={onNavigate}
      >
        {value.caseName}
      </Link>
      <span aria-hidden="true" className="text-border">
        ·
      </span>
      <span className="text-muted-foreground min-w-0 truncate">
        {value.clientName}
      </span>
    </div>
  );
}
