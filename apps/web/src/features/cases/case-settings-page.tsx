import { ArrowLeft, Archive, BriefcaseBusiness, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { ApiClientError } from "@/lib/api/fetcher";
import {
  getGetCaseQueryKey,
  getListCasesGroupedByClientQueryKey,
  useArchiveCase,
  useGetCase,
  useRestoreCase,
  useUpdateCase,
} from "@/lib/api/generated/cases/cases";
import type { CaseInput } from "@/lib/api/generated/models";
import { CaseForm } from "./case-form";
import { CasePeopleSettings } from "./case-people-settings";

export function CaseSettingsPage() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useGetCase(caseId);
  const update = useUpdateCase();
  const archive = useArchiveCase();
  const restore = useRestoreCase();
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetCaseQueryKey(caseId),
    });
    void queryClient.invalidateQueries({
      queryKey: getListCasesGroupedByClientQueryKey(),
    });
  };
  const notFound =
    !caseId ||
    (detail.error instanceof ApiClientError && detail.error.status === 404);

  if (detail.isPending && caseId)
    return (
      <AppPage aria-label="Cargando configuración del caso">
        <div className="space-y-5 py-5 lg:py-7">
          <div className="bg-muted rounded-control h-5 w-36 animate-pulse" />
          <div className="border-border space-y-3 border-b pb-5">
            <div className="bg-muted rounded-control h-8 w-72 animate-pulse" />
            <div className="bg-muted rounded-control h-5 w-56 animate-pulse" />
          </div>
          <div className="bg-muted rounded-card h-80 animate-pulse" />
        </div>
      </AppPage>
    );
  if (notFound)
    return (
      <AppPage className="grid place-items-center py-12">
        <div className="border-border bg-card shadow-panel rounded-card w-full max-w-lg space-y-5 border p-7">
          <div className="border-primary space-y-2 border-l-2 pl-4">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">
              Caso no encontrado
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              El caso no está disponible en este estudio.
            </p>
          </div>
          <Link
            to="/cases"
            className="text-primary hover:text-primary-strong focus-visible:ring-ring inline-flex text-sm font-semibold outline-none focus-visible:ring-2"
          >
            Volver a casos
          </Link>
        </div>
      </AppPage>
    );
  if (detail.isError || !detail.data)
    return (
      <AppPage className="grid place-items-center py-12">
        <div className="border-border bg-card shadow-panel rounded-card w-full max-w-lg space-y-5 border p-7">
          <div className="border-danger space-y-2 border-l-2 pl-4">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">
              No pudimos cargar la configuración
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Revisa tu conexión e inténtalo nuevamente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void detail.refetch()}
            >
              Intentar de nuevo
            </Button>
            <Link
              to={`/cases/${caseId}`}
              className="text-primary hover:text-primary-strong focus-visible:ring-ring inline-flex text-sm font-semibold outline-none focus-visible:ring-2"
            >
              Volver al caso
            </Link>
          </div>
        </div>
      </AppPage>
    );
  const record = detail.data.case;
  async function save(input: CaseInput) {
    const {
      initialMemberUserIds: _,
      initialFollowerUserIds: __,
      ...data
    } = input;
    await update.mutateAsync({ caseId, data });
    refresh();
    navigate(`/cases/${caseId}`);
  }
  async function lifecycle() {
    if (record.archivedAt) await restore.mutateAsync({ caseId });
    else await archive.mutateAsync({ caseId });
    refresh();
  }
  return (
    <AppPage>
      <div className="w-full max-w-5xl">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to={`/cases/${caseId}`}>
            <ArrowLeft />
            Volver al caso
          </Link>
        </Button>
        <AppPageHeader
          className="mt-5"
          icon={BriefcaseBusiness}
          eyebrow="Configuración"
          title={record.identification}
          description="Edita los datos del caso y controla su disponibilidad en la cartera."
        />
        <AppPageContent>
          {record.archivedAt ? (
            <p
              role="status"
              className="rounded-control border-border bg-muted/60 border px-4 py-3 text-sm"
            >
              Este caso está archivado. Restáuralo para editar sus datos o su
              equipo.
            </p>
          ) : null}
          <Tabs defaultValue="general" className="w-auto">
            <TabsList variant="line" aria-label="Secciones de configuración">
              <TabsTrigger
                value="general"
                className="after:bg-primary px-4 py-3"
              >
                General
              </TabsTrigger>
              <TabsTrigger value="team" className="after:bg-primary px-4 py-3">
                Personas
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-5 space-y-5">
              <section className="rounded-card border-border bg-card shadow-panel overflow-hidden border">
                <CaseForm
                  initial={{ ...record, client: record.client }}
                  onSubmit={save}
                  pending={update.isPending}
                  disabled={Boolean(record.archivedAt)}
                />
              </section>
              <section className="rounded-card border-border bg-card border p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-semibold">
                      {record.archivedAt ? "Restaurar caso" : "Archivar caso"}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {record.archivedAt
                        ? "El caso volverá a admitir cambios."
                        : "Se conservará el historial, pero quedará en modo de solo lectura."}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => void lifecycle()}>
                    {record.archivedAt ? <RotateCcw /> : <Archive />}
                    {record.archivedAt ? "Restaurar" : "Archivar"}
                  </Button>
                </div>
              </section>
            </TabsContent>
            <TabsContent value="team" className="mt-5">
              <CasePeopleSettings
                caseId={caseId}
                disabled={Boolean(record.archivedAt)}
              />
            </TabsContent>
          </Tabs>
        </AppPageContent>
      </div>
    </AppPage>
  );
}
