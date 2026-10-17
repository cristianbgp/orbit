import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { PreAppAccountControls } from "@/features/auth/pre-app-account-controls";
import { PreAppStatusScreen } from "@/features/auth/pre-app-status-screen";
import { selectCurrentOrganization } from "./organization-routing";
import type { OrganizationSummary } from "./organization-types";
import { OrganizationCalendarProvider } from "./organization-calendar-context";

export type OrganizationGuardState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      organizations: OrganizationSummary[];
      activeOrganizationId: string | null;
    };

type OrganizationGuardProps = {
  state: OrganizationGuardState;
  account: PreAppAccountControls;
  activate(organizationId: string): Promise<void>;
  retry(): void;
  renderLoadingScreen?: boolean;
};

export function OrganizationGuard({
  state,
  account,
  activate,
  retry,
  renderLoadingScreen = true,
}: OrganizationGuardProps) {
  const location = useLocation();
  const [locallyActiveId, setLocallyActiveId] = useState<string | null>(null);
  const [activationState, setActivationState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const activationAttemptRef = useRef<string | null>(null);
  const selected = useMemo(
    () =>
      state.status === "ready"
        ? selectCurrentOrganization(
            state.organizations,
            state.activeOrganizationId,
          )
        : null,
    [state],
  );
  const effectiveActiveId =
    state.status === "ready"
      ? (state.activeOrganizationId ?? locallyActiveId)
      : null;
  const requiresActivation = Boolean(
    selected && selected.id !== effectiveActiveId,
  );

  useEffect(() => {
    if (
      state.status !== "ready" ||
      !selected ||
      !requiresActivation ||
      activationState !== "idle" ||
      activationAttemptRef.current === selected.id
    ) {
      return;
    }

    activationAttemptRef.current = selected.id;
    setActivationState("loading");

    void activate(selected.id)
      .then(() => {
        setLocallyActiveId(selected.id);
        activationAttemptRef.current = null;
        setActivationState("idle");
      })
      .catch(() => {
        setActivationState("error");
      });
  }, [activate, activationState, requiresActivation, selected, state.status]);

  if (state.status === "loading") {
    if (!renderLoadingScreen) return null;

    return (
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu estudio"
        description="Estamos comprobando el espacio de trabajo de tu cuenta."
        account={account}
      />
    );
  }

  if (state.status === "error") {
    return (
      <PreAppStatusScreen
        state="error"
        title="No pudimos comprobar tu estudio"
        description="Revisa tu conexión e inténtalo nuevamente."
        account={account}
        action={{ label: "Intentar de nuevo", onClick: retry }}
      />
    );
  }

  if (activationState === "error") {
    return (
      <PreAppStatusScreen
        state="error"
        title="No pudimos abrir tu estudio"
        description="Tu información está segura. Intenta abrir el estudio nuevamente."
        account={account}
        action={{
          label: "Intentar de nuevo",
          onClick: () => {
            activationAttemptRef.current = null;
            setLocallyActiveId(null);
            setActivationState("idle");
          },
        }}
      />
    );
  }

  if (requiresActivation || activationState === "loading") {
    return (
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu estudio"
        description="Estamos abriendo tu espacio de trabajo."
        account={account}
      />
    );
  }

  if (!selected) return <Outlet />;

  if (location.pathname.startsWith("/onboarding/")) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <OrganizationCalendarProvider timeZone={selected.timeZone}>
      <Outlet />
    </OrganizationCalendarProvider>
  );
}
