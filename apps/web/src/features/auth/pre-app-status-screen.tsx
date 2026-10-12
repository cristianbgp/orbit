import { useState } from "react";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PreAppAccountBar,
  type PreAppAccountControls,
} from "@/features/auth/pre-app-account-controls";
import { cn } from "@/lib/utils";

export type PreAppStatusScreenProps = {
  state: "loading" | "error";
  title: string;
  description: string;
  account?: PreAppAccountControls;
  action?: { label: string; onClick(): void };
};

const LOADING_ORBIT_DURATION_MS = 2_800;

function loadingOrbitAnimationDelay() {
  const elapsed = typeof performance === "undefined" ? 0 : performance.now();
  return `-${elapsed % LOADING_ORBIT_DURATION_MS}ms`;
}

function LoadingOrbit() {
  const [animationDelay] = useState(loadingOrbitAnimationDelay);

  return (
    <div
      data-testid="pre-app-loading-orbit"
      aria-hidden="true"
      className="relative size-14 motion-safe:animate-spin motion-safe:[animation-duration:2.8s]"
      style={{ animationDelay }}
    >
      <span className="border-primary/25 absolute inset-1 rounded-full border" />
      <span className="bg-primary shadow-primary/20 absolute top-0 left-1/2 size-3 -translate-x-1/2 rounded-full shadow-md" />
      <span className="bg-primary/15 absolute top-1/2 left-1/2 size-4 -translate-1/2 rounded-full" />
    </div>
  );
}

export function PreAppStatusScreen({
  state,
  title,
  description,
  account,
  action,
}: PreAppStatusScreenProps) {
  return (
    <main className="bg-background text-foreground relative min-h-svh min-w-0 overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="border-primary/15 absolute -top-32 -right-32 size-80 rounded-full border" />
        <div className="bg-primary/5 absolute -bottom-48 -left-48 size-112 rounded-full" />
      </div>

      <div className="relative mx-auto flex min-h-svh w-full max-w-6xl min-w-0 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        <PreAppAccountBar account={account} />

        <div
          data-testid="pre-app-status-layout"
          className="grid flex-1 grid-cols-1 items-center gap-8 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14"
        >
          <div className="hidden max-w-md space-y-4 lg:block">
            <p className="font-display text-4xl leading-[1.08] font-semibold tracking-[-0.04em]">
              Tu trabajo legal, en una órbita clara.
            </p>
            <p className="text-muted-foreground max-w-sm leading-7">
              Estamos preparando un acceso seguro a tus proyectos, plazos y
              equipo.
            </p>
          </div>

          <section
            data-slot="pre-app-status-screen"
            role={state === "loading" ? "status" : "alert"}
            aria-live={state === "loading" ? "polite" : undefined}
            aria-label={title}
            className="border-border bg-card shadow-panel rounded-card mx-auto w-full max-w-xl min-w-0 border p-6 sm:p-8 lg:max-w-none"
          >
            <div
              className={
                state === "loading"
                  ? "bg-primary/10 mb-7 flex size-20 items-center justify-center rounded-full"
                  : "bg-danger-soft text-danger mb-7 flex size-14 items-center justify-center rounded-full"
              }
            >
              {state === "loading" ? (
                <LoadingOrbit />
              ) : (
                <CircleAlert aria-hidden="true" className="size-7" />
              )}
            </div>

            <div
              className={cn(
                "border-primary space-y-3 border-l-2 pl-4 sm:pl-5",
                state === "loading" && "min-h-28",
              )}
            >
              <h1 className="font-display text-2xl leading-tight font-semibold tracking-[-0.035em] sm:text-3xl">
                {title}
              </h1>
              <p className="text-muted-foreground max-w-md text-sm leading-6 sm:text-base sm:leading-7">
                {description}
              </p>
            </div>

            {action ? (
              <Button
                type="button"
                variant="outline"
                className="mt-7 active:translate-y-px"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
