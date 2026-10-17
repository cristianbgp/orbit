import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ApiStatusState = "loading" | "available" | "unavailable";

type ApiStatusCardProps = {
  state: ApiStatusState;
  onRetry: () => void;
};

const statusContent = {
  loading: {
    eyebrow: "Estado del sistema",
    title: "Conectando con Orbit",
    description: "Comprobando la base técnica",
    badge: "En verificación",
    badgeClassName: "bg-info-soft text-info",
    dotClassName: "bg-info motion-safe:animate-pulse",
  },
  available: {
    eyebrow: "Estado del sistema",
    title: "API disponible",
    description: "La base de Orbit está operativa.",
    badge: "Disponible",
    badgeClassName: "bg-success-soft text-success",
    dotClassName: "bg-success",
  },
  unavailable: {
    eyebrow: "Atención requerida",
    title: "API no disponible",
    description:
      "No pudimos conectar con el servicio. Puedes intentarlo otra vez.",
    badge: "Sin conexión",
    badgeClassName: "bg-danger-soft text-danger",
    dotClassName: "bg-danger",
  },
} as const;

export function ApiStatusCard({ state, onRetry }: ApiStatusCardProps) {
  const content = statusContent[state];

  return (
    <section
      aria-live="polite"
      className="rounded-card border-border bg-card shadow-panel w-full max-w-xl border p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
            {content.eyebrow}
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-foreground text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
              {content.title}
            </h1>
            <p className="text-muted-foreground max-w-md text-sm leading-6">
              {content.description}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
            content.badgeClassName,
          )}
        >
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", content.dotClassName)}
          />
          {content.badge}
        </span>
      </div>

      {state === "unavailable" ? (
        <div className="border-border mt-6 border-t pt-5">
          <Button variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : null}
    </section>
  );
}
