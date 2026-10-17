import { useState, type ReactNode } from "react";

import { OrbitMark } from "@/components/orbit-mark";
import {
  AuthForm,
  type AuthFormActions,
  type AuthMode,
} from "@/features/auth/auth-form";
import { PreAppStatusScreen } from "@/features/auth/pre-app-status-screen";

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthSessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "error" }
  | { status: "authenticated"; user: AuthenticatedUser };

type AuthShellProps = {
  sessionState: AuthSessionState;
  actions: AuthFormActions;
  children: ReactNode;
  anonymousContext?: { title: string; description: string };
  anonymousContent?: ReactNode;
  renderLoadingScreen?: boolean;
};

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <OrbitMark />
      <div>
        <p className="font-display text-xl font-semibold tracking-[-0.03em]">
          Orbit
        </p>
        <p className="text-muted-foreground text-xs">
          Gestión de proyectos legales
        </p>
      </div>
    </div>
  );
}

export function AuthShell({
  sessionState,
  actions,
  children,
  anonymousContext,
  anonymousContent,
  renderLoadingScreen = true,
}: AuthShellProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");

  if (!anonymousContent && sessionState.status === "loading") {
    if (!renderLoadingScreen) return null;

    return (
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu sesión"
        description="Estamos comprobando tu acceso seguro a Orbit."
      />
    );
  }

  if (!anonymousContent && sessionState.status === "error") {
    return (
      <PreAppStatusScreen
        state="error"
        title="No pudimos comprobar tu sesión"
        description="Actualiza la página para intentarlo nuevamente."
      />
    );
  }

  if (anonymousContent || sessionState.status === "anonymous") {
    return (
      <main className="bg-background text-foreground min-h-[100dvh]">
        <div className="mx-auto grid min-h-[100dvh] max-w-6xl md:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <section className="border-border hidden border-r px-12 py-14 md:flex md:flex-col md:justify-between lg:px-16">
            <Brand />
            <div className="max-w-md space-y-5">
              <p className="font-display text-4xl leading-[1.08] font-semibold tracking-[-0.045em] lg:text-5xl">
                El trabajo legal, en una órbita clara.
              </p>
              <p className="text-muted-foreground max-w-sm text-base leading-7">
                Organiza asuntos, plazos y colaboración desde un espacio seguro.
              </p>
            </div>
            <p className="text-muted-foreground max-w-xs text-xs leading-5">
              Acceso protegido para tu equipo y la información de cada proyecto.
            </p>
          </section>

          <section className="flex min-h-[100dvh] items-center px-5 py-10 sm:px-10 md:min-h-0 md:px-12 lg:px-16">
            <div className="mx-auto w-full max-w-sm space-y-10">
              <div className="md:hidden">
                <Brand />
              </div>
              {anonymousContext ? (
                <div className="border-primary space-y-2 border-l-2 pl-4">
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.035em]">
                    {anonymousContext.title}
                  </h1>
                  <p className="text-muted-foreground text-sm leading-6">
                    {anonymousContext.description}
                  </p>
                </div>
              ) : null}
              {anonymousContent ?? (
                <AuthForm
                  mode={mode}
                  actions={actions}
                  onModeChange={setMode}
                />
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return children;
}
