import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { PreAppAccountControls } from "@/features/auth/pre-app-account-controls";
import { PreAppStatusScreen } from "@/features/auth/pre-app-status-screen";

export type InvitationOnboardingGuardState =
  | { status: "inactive" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; activeInvitationCount: number };

type InvitationOnboardingGuardProps = {
  state: InvitationOnboardingGuardState;
  account: PreAppAccountControls;
  retry(): void;
  renderLoadingScreen?: boolean;
};

export function InvitationOnboardingGuard({
  state,
  account,
  retry,
  renderLoadingScreen = true,
}: InvitationOnboardingGuardProps) {
  const location = useLocation();

  if (state.status === "inactive") return <Outlet />;

  if (state.status === "loading") {
    if (!renderLoadingScreen) return null;

    return (
      <PreAppStatusScreen
        state="loading"
        title="Comprobando tus invitaciones"
        description="Estamos revisando si un estudio está esperando tu respuesta."
        account={account}
      />
    );
  }

  if (state.status === "error") {
    return (
      <PreAppStatusScreen
        state="error"
        title="No pudimos comprobar tus invitaciones"
        description="Revisa tu conexión e inténtalo nuevamente."
        account={account}
        action={{ label: "Intentar de nuevo", onClick: retry }}
      />
    );
  }

  const target =
    state.activeInvitationCount > 0
      ? "/onboarding/invitations"
      : "/onboarding/organization";

  return location.pathname === target ? (
    <Outlet />
  ) : (
    <Navigate to={target} replace />
  );
}
