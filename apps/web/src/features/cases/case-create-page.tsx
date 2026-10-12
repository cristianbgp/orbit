import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import {
  getListCasesGroupedByClientQueryKey,
  useCreateCase,
} from "@/lib/api/generated/cases/cases";
import type { CaseInput } from "@/lib/api/generated/models";
import { CaseForm } from "./case-form";
export function CaseCreatePage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const mutation = useCreateCase();
  async function submit(data: CaseInput) {
    const result = await mutation.mutateAsync({ data });
    void client.invalidateQueries({
      queryKey: getListCasesGroupedByClientQueryKey(),
    });
    navigate(`/cases/${result.case.id}`, { replace: true });
  }
  return (
    <AppPage className="py-6 lg:py-8">
      <div className="w-full max-w-4xl">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to="/cases">
            <ArrowLeft aria-hidden="true" />
            Volver a casos
          </Link>
        </Button>
        <AppPageHeader
          className="mt-5"
          icon={BriefcaseBusiness}
          eyebrow="Cartera procesal"
          title="Nuevo caso"
          description="Registra los datos del proceso, su clasificación, período y equipo inicial. Podrás completar o modificar la información después."
        />
        <AppPageContent>
          <section
            aria-labelledby="new-case-form-title"
            className="rounded-card border-border bg-card shadow-panel overflow-hidden border"
          >
            <h2 id="new-case-form-title" className="sr-only">
              Datos del nuevo caso
            </h2>
            <CaseForm
              onSubmit={submit}
              onCancel={() => navigate("/cases")}
              pending={mutation.isPending}
            />
          </section>
        </AppPageContent>
      </div>
    </AppPage>
  );
}
