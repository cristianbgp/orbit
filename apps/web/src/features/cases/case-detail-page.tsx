import { Settings } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { useGetCase } from "@/lib/api/generated/cases/cases";
import { ApiClientError } from "@/lib/api/fetcher";
import { CaseActivityList } from "./case-activity-list";
import { CaseSummary } from "./case-summary";
import { CasePeopleSettings } from "./case-people-settings";
import { CaseUpdatesSection } from "./case-updates-section";
import { CaseActionsSection } from "./case-actions-section";
import { CaseEventsSection } from "./case-events-section";
import {
  formatCaseAmount,
  formatCaseClaimant,
  formatCasePeriod,
  getCaseLabel,
} from "./case-presenters";

function BackToCasesLink() {
  return (
    <Link
      to="/cases"
      className="text-primary hover:text-primary-strong focus-visible:ring-ring inline-flex rounded-sm text-sm font-semibold outline-none focus-visible:ring-2"
    >
      Volver a casos
    </Link>
  );
}

function CaseDetailSkeleton() {
  return (
    <AppPage
      role="status"
      aria-live="polite"
      aria-label="Cargando caso"
      className="space-y-6 py-5 lg:py-7"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-control bg-muted h-5 w-28 motion-safe:animate-pulse" />
        <div className="rounded-control bg-muted h-9 w-36 motion-safe:animate-pulse" />
      </div>
      <div className="rounded-card border-border overflow-hidden border">
        <div className="bg-primary/40 h-1" />
        <div className="grid gap-6 p-5 pt-7 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]">
          <div className="space-y-3">
            <div className="rounded-control bg-muted h-6 w-40 motion-safe:animate-pulse" />
            <div className="rounded-control bg-muted h-10 max-w-xl motion-safe:animate-pulse" />
            <div className="rounded-control bg-muted h-5 w-56 motion-safe:animate-pulse" />
          </div>
          <div className="border-border space-y-3 border-l-2 pl-4">
            <div className="rounded-control bg-muted h-4 w-32 motion-safe:animate-pulse" />
            <div className="rounded-control bg-muted h-12 w-full motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="rounded-card bg-muted h-72 motion-safe:animate-pulse lg:col-span-8" />
        <div className="rounded-card bg-muted h-72 motion-safe:animate-pulse lg:col-span-4" />
      </div>
    </AppPage>
  );
}

function CaseNotFound() {
  return (
    <AppPage className="grid place-items-center py-12">
      <div className="rounded-card border-border bg-card shadow-panel w-full max-w-lg space-y-5 border p-7">
        <div className="border-primary space-y-2 border-l-2 pl-4">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-balance">
            Caso no encontrado
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            El caso no está disponible en este estudio.
          </p>
        </div>
        <BackToCasesLink />
      </div>
    </AppPage>
  );
}

function CaseLoadError({ onRetry }: { onRetry(): void }) {
  return (
    <AppPage className="grid place-items-center py-12">
      <div className="rounded-card border-border bg-card shadow-panel w-full max-w-lg space-y-5 border p-7">
        <div className="border-danger space-y-2 border-l-2 pl-4">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-balance">
            No pudimos cargar el caso
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Revisa tu conexión e inténtalo nuevamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Intentar de nuevo
          </Button>
          <BackToCasesLink />
        </div>
      </div>
    </AppPage>
  );
}

export function CaseDetailPage() {
  const { caseId = "" } = useParams();
  const detail = useGetCase(caseId, {
    query: { enabled: Boolean(caseId) },
  });
  const notFound =
    !caseId ||
    (detail.error instanceof ApiClientError && detail.error.status === 404);

  if (detail.isPending && caseId) return <CaseDetailSkeleton />;
  if (notFound) return <CaseNotFound />;
  if (detail.isError || !detail.data) {
    return <CaseLoadError onRetry={() => void detail.refetch()} />;
  }

  const record = detail.data.case;
  const item = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value || "Sin definir"}</dd>
    </div>
  );
  return (
    <AppPage className="py-5 lg:py-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackToCasesLink />
        <Button asChild>
          <Link to={`/cases/${caseId}/settings`}>
            <Settings aria-hidden="true" />
            Configurar caso
          </Link>
        </Button>
      </div>

      {record.archivedAt ? (
        <div
          role="status"
          className="rounded-control border-border bg-muted text-muted-foreground mb-5 border px-4 py-3 text-sm font-medium"
        >
          Este caso está archivado y es de solo lectura.
        </div>
      ) : null}

      <CaseSummary record={record} />
      <AppPageContent className="lg:grid-cols-12">
        <section className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-6 lg:col-span-8">
          <h2 className="font-display text-xl font-semibold">
            Información del proceso
          </h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {item("Subtipo", getCaseLabel("subtype", record.subtype))}
            {record.stage ? item("Expediente", record.docketNumber) : null}
            {item("Etapa", getCaseLabel("stage", record.stage))}
            {item("Entidad", getCaseLabel("entity", record.entity))}
            {item("Tributo", getCaseLabel("tax", record.tax))}
            {item(
              "Período",
              formatCasePeriod(
                record.periodKind,
                record.periodStart,
                record.periodEnd,
              ),
            )}
            {item("Importe", formatCaseAmount(record.amount, record.currency))}
            {record.type === "judicial"
              ? item(
                  "Demandante",
                  formatCaseClaimant(record.claimantType, record.client.name),
                )
              : null}
            {item("Resolución impugnada", record.challengedResolution)}
            {record.result
              ? item("Resultado", getCaseLabel("result", record.result))
              : null}
          </dl>
          {record.disputedMatter ? (
            <div className="border-border mt-6 border-t pt-5">
              <h3 className="text-sm font-semibold">Materia controvertida</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6 whitespace-pre-wrap">
                {record.disputedMatter}
              </p>
            </div>
          ) : null}
        </section>
        <div className="lg:col-span-4">
          <CasePeopleSettings caseId={caseId} disabled compact readOnly />
        </div>
        <div className="lg:col-span-12">
          <CaseEventsSection
            caseId={caseId}
            disabled={Boolean(record.archivedAt)}
            caseContext={{
              caseId,
              caseName: record.identification,
              clientName: record.client.name,
            }}
          />
        </div>
        <div className="grid items-start gap-5 lg:col-span-12 lg:grid-cols-2">
          <CaseUpdatesSection
            caseId={caseId}
            disabled={Boolean(record.archivedAt)}
          />
          <CaseActionsSection
            caseId={caseId}
            disabled={Boolean(record.archivedAt)}
          />
        </div>
        <div className="lg:col-span-12">
          <CaseActivityList caseId={caseId} />
        </div>
      </AppPageContent>
    </AppPage>
  );
}
