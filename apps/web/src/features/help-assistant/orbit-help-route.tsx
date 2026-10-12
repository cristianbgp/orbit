import { Link } from "react-router-dom";
import { CircleHelp, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppPage } from "@/features/layout/app-page";
import { useFeatureFlagsQuery } from "@/features/feature-flags/use-feature-flag";

import { OrbitHelpPage } from "./orbit-help-page";

type OrbitHelpRouteProps = {
  userId: string;
  organizationId: string;
};

export function OrbitHelpRoute({
  userId,
  organizationId,
}: OrbitHelpRouteProps) {
  const flags = useFeatureFlagsQuery({ userId, organizationId });

  if (flags.isPending) {
    return (
      <AppPage className="grid place-items-center py-12">
        <div role="status" className="text-center">
          <span className="bg-primary-soft text-primary mx-auto grid size-12 place-items-center rounded-full">
            <CircleHelp aria-hidden="true" className="size-6 animate-pulse" />
          </span>
          <p className="mt-4 font-semibold">Preparando Preguntar a Orbit</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Estamos comprobando si está disponible para tu estudio.
          </p>
        </div>
      </AppPage>
    );
  }

  if (flags.isError) {
    return (
      <AppPage className="grid place-items-center py-12">
        <div role="alert" className="max-w-md text-center">
          <p className="font-semibold">No pudimos comprobar esta función</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Revisa tu conexión e inténtalo nuevamente.
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => void flags.refetch()}
          >
            <RotateCcw aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      </AppPage>
    );
  }

  if (flags.data?.features.orbitHelpAssistant !== true) {
    return (
      <AppPage className="grid place-items-center py-12">
        <div className="max-w-md text-center">
          <span className="bg-muted text-muted-foreground mx-auto grid size-12 place-items-center rounded-full">
            <CircleHelp aria-hidden="true" className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">
            Esta función no está disponible para este estudio
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Preguntar a Orbit se habilita gradualmente mediante una
            configuración del estudio.
          </p>
          <Button className="mt-5" variant="outline" asChild>
            <Link to="/projects">Volver a proyectos</Link>
          </Button>
        </div>
      </AppPage>
    );
  }

  return <OrbitHelpPage />;
}
