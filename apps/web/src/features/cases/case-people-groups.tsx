import type { ReactNode } from "react";

function PeopleGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-fit">
      <p className="border-border text-muted-foreground border-b pb-1 text-[0.625rem] leading-4 font-semibold tracking-[0.08em] uppercase">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function CasePeopleGroups({
  caseName,
  team,
  followers,
}: {
  caseName: string;
  team: ReactNode;
  followers: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={`Participación de ${caseName}`}
      className="w-full max-w-full min-w-0 overflow-hidden [contain:inline-size]"
    >
      <div
        role="region"
        aria-label={`Equipo y seguimiento de ${caseName}`}
        tabIndex={0}
        className="focus-visible:ring-ring w-full max-w-full min-w-0 [scrollbar-gutter:stable] overflow-x-auto overscroll-x-contain focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <div className="flex w-max min-w-full flex-col sm:flex-row sm:items-stretch">
          <div className="min-w-fit pb-3 sm:pr-3 sm:pb-0">
            <PeopleGroup label="Equipo">{team}</PeopleGroup>
          </div>
          <div className="border-border min-w-fit border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
            <PeopleGroup label="Seguimiento">{followers}</PeopleGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
