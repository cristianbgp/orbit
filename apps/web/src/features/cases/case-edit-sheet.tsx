import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getGetCasePresentationQueryKey,
  getGetCaseQueryKey,
  getListCaseActivitiesQueryKey,
  getListCasesGroupedByClientQueryKey,
  useGetCase,
  useUpdateCase,
} from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";
import type { CaseInput } from "@/lib/api/generated/models";
import { CaseForm } from "./case-form";
import { CaseSheetContext } from "./case-sheet-context";
import { CasePeopleSettings } from "./case-people-settings";

export function CaseEditSheet({
  open,
  caseId,
  caseName,
  clientName,
  onOpenChange,
}: {
  open: boolean;
  caseId: string;
  caseName: string;
  clientName: string;
  onOpenChange(open: boolean): void;
}) {
  const queryClient = useQueryClient();
  const detail = useGetCase(caseId, { query: { enabled: open } });
  const update = useUpdateCase();

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: getGetCasePresentationQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetCaseQueryKey(caseId),
    });
    void queryClient.invalidateQueries({
      queryKey: getListCasesGroupedByClientQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getListCaseActivitiesQueryKey(caseId),
    });
    void queryClient.invalidateQueries({
      queryKey: getListDashboardActivityQueryKey(),
    });
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) refresh();
    onOpenChange(nextOpen);
  }

  async function save(input: CaseInput) {
    const {
      initialMemberUserIds: _,
      initialFollowerUserIds: __,
      ...data
    } = input;
    await update.mutateAsync({ caseId, data });
    refresh();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent className="w-full max-w-none gap-0 overflow-y-auto overscroll-contain sm:w-[min(92vw,64rem)] sm:max-w-5xl!">
        <SheetHeader className="border-border border-b pr-16">
          <SheetTitle className="font-display text-xl">Editar caso</SheetTitle>
          <SheetDescription className="leading-6">
            Actualiza los datos y el equipo sin abandonar la presentación.
          </SheetDescription>
          <CaseSheetContext
            value={{ caseId, caseName, clientName }}
            onNavigate={() => changeOpen(false)}
          />
        </SheetHeader>

        {detail.isPending ? (
          <div role="status" className="space-y-4 p-5 sm:p-7">
            <span className="sr-only">Cargando caso</span>
            <div className="bg-muted rounded-card h-28 animate-pulse" />
            <div className="bg-muted rounded-card h-52 animate-pulse" />
          </div>
        ) : detail.isError || !detail.data ? (
          <div className="p-5 sm:p-7">
            <p role="alert" className="text-danger text-sm">
              No pudimos cargar los datos del caso.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void detail.refetch()}
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="general" className="min-h-0 flex-1">
            <div className="border-border bg-background sticky top-0 z-10 border-b px-4 sm:px-7">
              <TabsList
                variant="line"
                aria-label="Secciones de edición del caso"
              >
                <TabsTrigger
                  value="general"
                  className="after:bg-primary px-4 py-3"
                >
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="team"
                  className="after:bg-primary px-4 py-3"
                >
                  Personas
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="general" className="mt-0">
              <CaseForm
                initial={{
                  ...detail.data.case,
                  client: detail.data.case.client,
                }}
                pending={update.isPending}
                disabled={Boolean(detail.data.case.archivedAt)}
                onCancel={() => changeOpen(false)}
                onSubmit={save}
              />
            </TabsContent>
            <TabsContent value="team" className="mt-0 p-4 sm:p-7">
              <CasePeopleSettings
                caseId={caseId}
                disabled={Boolean(detail.data.case.archivedAt)}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
