import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  PreAppAccountBar,
  type PreAppAccountControls,
  usePreAppSignOut,
} from "@/features/auth/pre-app-account-controls";
import { authClient } from "@/lib/auth-client";

type InvitationPageProps = {
  invitationId: string;
  userEmail: string;
  refreshSession(): Promise<void>;
  onSignOut(): Promise<void> | void;
};

type InvitationError = Error & { code?: string };

type InvitationDetails = {
  id: string;
  email: string;
  organizationName: string;
  inviterEmail?: string;
  expiresAt: Date | string;
};

function invitationError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return Object.assign(new Error(candidate?.message ?? "Invitation failed"), {
    code: candidate?.code,
  }) as InvitationError;
}

function formatExpiration(value: Date | string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function InvitationFrame({
  account,
  children,
}: {
  account: PreAppAccountControls;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background text-foreground grid min-h-[100dvh] place-items-center px-5 py-12">
      <div className="w-full max-w-xl space-y-8">
        <PreAppAccountBar account={account} />
        {children}
      </div>
    </main>
  );
}

export function InvitationPage({
  invitationId,
  userEmail,
  refreshSession,
  onSignOut,
}: InvitationPageProps) {
  const navigate = useNavigate();
  const account: PreAppAccountControls = {
    email: userEmail,
    ...usePreAppSignOut(onSignOut),
  };
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState<
    "membership" | "transient" | null
  >(null);
  const detailsQuery = useQuery({
    queryKey: ["invitation", invitationId],
    queryFn: async () => {
      const result = await authClient.organization.getInvitation({
        query: { id: invitationId },
      });
      if (result.error || !result.data) throw invitationError(result.error);
      return result.data as InvitationDetails;
    },
  });

  async function acceptInvitation() {
    setIsAccepting(true);
    setAcceptanceError(null);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (result.error) throw invitationError(result.error);
      await refreshSession();
      navigate("/projects", { replace: true });
    } catch (error) {
      setAcceptanceError(
        (error as InvitationError).code === "ORGANIZATION_MEMBERSHIP_EXISTS"
          ? "membership"
          : "transient",
      );
    } finally {
      setIsAccepting(false);
    }
  }

  if (detailsQuery.isPending) {
    return (
      <InvitationFrame account={account}>
        <div aria-label="Cargando invitación" className="space-y-3">
          <div className="rounded-control bg-muted h-8 w-3/4 animate-pulse" />
          <div className="rounded-card bg-muted h-28 animate-pulse" />
        </div>
      </InvitationFrame>
    );
  }

  if (detailsQuery.isError) {
    const code = (detailsQuery.error as InvitationError).code;
    const wrongAccount = code === "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION";
    return (
      <InvitationFrame account={account}>
        <section className="rounded-card border-border bg-card shadow-panel space-y-5 border p-6 sm:p-8">
          <div className="border-primary space-y-2 border-l-2 pl-4">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.035em]">
              {wrongAccount
                ? "Esta invitación corresponde a otra cuenta"
                : "Esta invitación no está disponible"}
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              {wrongAccount
                ? "Cierra sesión e ingresa con la cuenta que recibió el enlace."
                : "Solicita un nuevo enlace a la persona propietaria del estudio."}
            </p>
          </div>
          {wrongAccount ? (
            <Button
              variant="outline"
              disabled={account.isSigningOut}
              onClick={() => void account.signOut()}
            >
              {account.isSigningOut ? "Cerrando sesión…" : "Usar otra cuenta"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => void detailsQuery.refetch()}
            >
              Intentar de nuevo
            </Button>
          )}
        </section>
      </InvitationFrame>
    );
  }

  const invitation = detailsQuery.data;

  return (
    <InvitationFrame account={account}>
      <section className="rounded-card border-border bg-card shadow-panel overflow-hidden border">
        <div className="border-border space-y-2 border-b p-6 sm:p-8">
          <p className="text-primary text-sm font-semibold">
            Invitación al estudio
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.04em]">
            {invitation.organizationName}
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Revisa los datos antes de unirte. Tu acceso no se activará hasta que
            confirmes.
          </p>
        </div>

        <dl className="grid gap-5 p-6 text-sm sm:grid-cols-2 sm:p-8">
          <div>
            <dt className="text-muted-foreground text-xs font-semibold">
              Correo invitado
            </dt>
            <dd className="mt-1 font-medium">{invitation.email}</dd>
          </div>
          {invitation.inviterEmail ? (
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                Invitación enviada por
              </dt>
              <dd className="mt-1 font-medium">{invitation.inviterEmail}</dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs font-semibold">
              Vencimiento
            </dt>
            <dd className="mt-1 font-medium">
              {formatExpiration(invitation.expiresAt)}
            </dd>
          </div>
        </dl>

        <div className="border-border space-y-4 border-t p-6 sm:p-8">
          {acceptanceError === "membership" ? (
            <div
              role="alert"
              className="border-danger space-y-1 border-l-2 pl-4"
            >
              <p className="text-sm font-semibold">
                Esta cuenta ya pertenece a un estudio
              </p>
              <p className="text-muted-foreground text-sm leading-6">
                Orbit admite un estudio por cuenta por ahora. Ingresa con otra
                cuenta que use el correo invitado.
              </p>
            </div>
          ) : acceptanceError === "transient" ? (
            <p role="alert" className="text-danger text-sm">
              No pudimos aceptar la invitación. Inténtalo nuevamente.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={isAccepting}
              onClick={() => void acceptInvitation()}
            >
              {isAccepting ? "Uniéndome al estudio" : "Unirme al estudio"}
            </Button>
            <Button
              variant="ghost"
              disabled={isAccepting || account.isSigningOut}
              onClick={() => void account.signOut()}
            >
              {account.isSigningOut ? "Cerrando sesión…" : "Usar otra cuenta"}
            </Button>
          </div>
        </div>
      </section>
    </InvitationFrame>
  );
}
