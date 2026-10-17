import { ArrowLeft, FolderKanban } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import type { ProjectInput } from "@/lib/api/generated/models";
import {
  getListProjectsGroupedByClientQueryKey,
  getListProjectsQueryKey,
  useCreateProject,
} from "@/lib/api/generated/projects/projects";
import { ProjectForm } from "./project-form";

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useCreateProject();

  async function createProject(input: ProjectInput) {
    const result = await createMutation.mutateAsync({ data: input });
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getListProjectsGroupedByClientQueryKey(),
      }),
    ]);
    navigate(`/projects/${result.project.id}`, { replace: true });
  }

  return (
    <AppPage className="py-6 lg:py-8">
      <div className="w-full max-w-4xl">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to="/projects">
            <ArrowLeft aria-hidden="true" />
            Volver a proyectos
          </Link>
        </Button>

        <AppPageHeader
          icon={FolderKanban}
          eyebrow="Cartera legal"
          title="Nuevo proyecto"
          description="Registra el asunto, su periodo y el equipo que comenzará a trabajarlo. Podrás ajustar las etapas y los eventos desde su configuración."
          className="mt-5"
        />

        <AppPageContent>
          <section
            aria-labelledby="new-project-form-title"
            className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-7"
          >
            <h2 id="new-project-form-title" className="sr-only">
              Datos del nuevo proyecto
            </h2>
            <ProjectForm
              onSubmit={createProject}
              onCancel={() => navigate("/projects")}
            />
          </section>
        </AppPageContent>
      </div>
    </AppPage>
  );
}
