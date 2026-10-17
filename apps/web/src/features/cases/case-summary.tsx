import { BriefcaseBusiness } from "lucide-react";

import type { LegalCase } from "@/lib/api/generated/models";
import { getCaseLabel } from "./case-presenters";
import { CaseStatusBadge } from "./case-status-badge";

function CaseSituationItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[0.69rem] font-semibold tracking-[0.08em] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

export function CaseSummary({ record }: { record: LegalCase }) {
  return (
    <section
      aria-label="Resumen del caso"
      className="rounded-card border-border bg-card shadow-panel relative overflow-hidden border"
    >
      <div
        aria-hidden="true"
        className="bg-primary absolute inset-x-0 top-0 h-1"
      />
      <div className="grid gap-6 p-5 pt-7 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)] lg:gap-10">
        <header className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span
            data-slot="app-page-header-icon"
            className="bg-primary-soft text-primary-strong flex size-11 shrink-0 items-center justify-center rounded-xl"
          >
            <BriefcaseBusiness aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CaseStatusBadge status={record.status} />
              {record.archivedAt ? (
                <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
                  Archivado
                </span>
              ) : null}
              <span className="text-primary text-xs font-semibold">
                {getCaseLabel("type", record.type)}
              </span>
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-4xl">
              {record.identification}
            </h1>
            <p className="text-foreground text-sm font-medium">
              {record.client.name}
            </p>
          </div>
        </header>

        <div className="border-primary/20 border-l-2 pl-4 lg:self-end">
          <p className="text-muted-foreground text-[0.69rem] font-semibold tracking-[0.08em] uppercase">
            Situación procesal
          </p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CaseSituationItem
              label="Etapa actual"
              value={getCaseLabel("stage", record.stage)}
            />
            <CaseSituationItem
              label="Entidad"
              value={getCaseLabel("entity", record.entity)}
            />
          </dl>
        </div>
      </div>
    </section>
  );
}
