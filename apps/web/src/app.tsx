import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { AuthFormActions } from "@/features/auth/auth-form";
import { AuthShell, type AuthSessionState } from "@/features/auth/auth-shell";
import { usePreAppSignOut } from "@/features/auth/pre-app-account-controls";
import { PreAppStatusScreen } from "@/features/auth/pre-app-status-screen";
import { PasswordResetPage } from "@/features/auth/password-reset-page";
import { InvitationPage } from "@/features/invitations/invitation-page";
import { getInvitationId } from "@/features/invitations/invitation-routing";
import {
  OrganizationRoutes,
  type OrganizationStartupPhase,
} from "@/features/organization/organization-routes";
import { authClient } from "@/lib/auth-client";

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  const [organizationStartup, setOrganizationStartup] = useState<{
    userId: string;
    phase: OrganizationStartupPhase;
  } | null>(null);
  const session = authClient.useSession();
  const invitationId = getInvitationId(location.pathname);
  const isPasswordReset = location.pathname === "/reset-password";
  const resetToken = isPasswordReset
    ? new URLSearchParams(location.search).get("token")
    : null;

  const sessionState: AuthSessionState = session.isPending
    ? { status: "loading" }
    : session.error
      ? { status: "error" }
      : session.data?.user
        ? {
            status: "authenticated",
            user: {
              id: session.data.user.id,
              name: session.data.user.name,
              email: session.data.user.email,
            },
          }
        : { status: "anonymous" };

  const actions: AuthFormActions = {
    async signIn(input) {
      const result = await authClient.signIn.email(input);
      if (result.error) throw new Error("Authentication failed");
      setPasswordResetComplete(false);
    },
    async signUp(input) {
      const result = await authClient.signUp.email(input);
      if (result.error) throw new Error("Registration failed");
      setPasswordResetComplete(false);
    },
  };

  async function signOut() {
    const result = await authClient.signOut();
    if (result.error) throw new Error("Sign out failed");
  }

  const preAppSignOut = usePreAppSignOut(signOut);
  const authenticatedUser = session.data?.user;
  const account = authenticatedUser
    ? { email: authenticatedUser.email, ...preAppSignOut }
    : undefined;
  const organizationStartupPhase = authenticatedUser
    ? organizationStartup?.userId === authenticatedUser.id
      ? organizationStartup.phase
      : "organization"
    : "ready";
  const startupLoading =
    !isPasswordReset &&
    (sessionState.status === "loading" ||
      (!invitationId &&
        sessionState.status === "authenticated" &&
        organizationStartupPhase !== "ready"));
  const handleStartupPhaseChange = useCallback(
    (phase: OrganizationStartupPhase) => {
      if (!authenticatedUser?.id) return;
      setOrganizationStartup({ userId: authenticatedUser.id, phase });
    },
    [authenticatedUser?.id],
  );

  const anonymousContext = passwordResetComplete
    ? {
        title: "Contraseña actualizada. Ya puedes iniciar sesión.",
        description:
          "Usa tu nueva contraseña para volver a entrar de forma segura.",
      }
    : invitationId
      ? {
          title: "Tienes una invitación para unirte a un estudio",
          description:
            "Inicia sesión o crea tu cuenta con el correo que recibió la invitación.",
        }
      : undefined;

  return (
    <>
      {startupLoading ? (
        <PreAppStatusScreen
          state="loading"
          title={
            sessionState.status === "loading"
              ? "Preparando tu sesión"
              : organizationStartupPhase === "invitations"
                ? "Comprobando tus invitaciones"
                : "Preparando tu estudio"
          }
          description={
            sessionState.status === "loading"
              ? "Estamos comprobando tu acceso seguro a Orbit."
              : organizationStartupPhase === "invitations"
                ? "Estamos revisando si un estudio está esperando tu respuesta."
                : "Estamos comprobando el espacio de trabajo de tu cuenta."
          }
          account={account}
        />
      ) : null}
      <AuthShell
        sessionState={
          passwordResetComplete ? { status: "anonymous" } : sessionState
        }
        actions={actions}
        renderLoadingScreen={false}
        anonymousContext={anonymousContext}
        anonymousContent={
          isPasswordReset ? (
            <PasswordResetPage
              token={resetToken}
              onComplete={() => {
                setPasswordResetComplete(true);
                navigate("/", { replace: true });
              }}
            />
          ) : undefined
        }
      >
        {passwordResetComplete ? null : session.data?.user && invitationId ? (
          <InvitationPage
            invitationId={invitationId}
            userEmail={session.data.user.email}
            refreshSession={async () => {
              await session.refetch();
            }}
            onSignOut={signOut}
          />
        ) : session.data?.user ? (
          <OrganizationRoutes
            user={session.data.user}
            activeOrganizationId={
              session.data.session.activeOrganizationId ?? null
            }
            refreshSession={async () => {
              await session.refetch();
            }}
            onSignOut={signOut}
            account={account!}
            onStartupPhaseChange={handleStartupPhaseChange}
          />
        ) : null}
      </AuthShell>
    </>
  );
}
