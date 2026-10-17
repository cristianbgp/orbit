import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  PreAppAccountBar,
  type PreAppAccountControls,
} from "@/features/auth/pre-app-account-controls";
import type { UserInvitation } from "./user-invitation-policy";

type InvitationOnboardingPageProps = {
  invitations: UserInvitation[];
  account: PreAppAccountControls;
  onReject(invitationId: string): Promise<void>;
};

function formatExpiration(value: Date | string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InvitationOnboardingPage({
  invitations,
  account,
  onReject,
}: InvitationOnboardingPageProps) {
  const [rejectTarget, setRejectTarget] = useState<UserInvitation | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  async function confirmRejection() {
    if (!rejectTarget || isRejecting) return;
    setIsRejecting(true);
    setRejectError(null);
    try {
      await onReject(rejectTarget.id);
      setRejectTarget(null);
    } catch {
      setRejectError(
        "No pudimos rechazar la invitación. Inténtalo nuevamente.",
      );
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <main className="bg-background text-foreground min-h-[100dvh] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <PreAppAccountBar account={account} />
        <header className="max-w-2xl space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Invitaciones pendientes
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-6 sm:text-base">
            Un estudio te invitó a colaborar. Revisa las invitaciones antes de
            crear tu propio espacio.
          </p>
        </header>

        <section aria-label="Invitaciones activas" className="space-y-4">
          {invitations.map((invitation) => {
            const isTarget = rejectTarget?.id === invitation.id;
            return (
              <article
                key={invitation.id}
                className="rounded-card border-border bg-card shadow-panel overflow-hidden border"
              >
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0 space-y-1.5">
                    <h2 className="font-display truncate text-xl font-semibold tracking-[-0.025em]">
                      {invitation.organizationName}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Vence el {formatExpiration(invitation.expiresAt)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                      to={`/invitations/${encodeURIComponent(invitation.id)}`}
                      aria-label={`Ver invitación de ${invitation.organizationName}`}
                      className="rounded-control bg-primary text-primary-foreground hover:bg-primary-strong focus-visible:ring-ring inline-flex h-10 items-center justify-center px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      Ver invitación
                    </Link>
                    <Button
                      variant="outline"
                      disabled={isRejecting}
                      aria-label={`Rechazar invitación de ${invitation.organizationName}`}
                      onClick={() => {
                        setRejectError(null);
                        setRejectTarget(invitation);
                      }}
                    >
                      Rechazar invitación
                    </Button>
                  </div>
                </div>

                {isTarget ? (
                  <div className="border-border bg-muted/40 space-y-4 border-t p-5 sm:p-6">
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-semibold">
                        Rechazar la invitación de {invitation.organizationName}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-6">
                        Si la rechazas, necesitarás un nuevo enlace para unirte
                        más adelante.
                      </p>
                    </div>
                    {rejectError ? (
                      <p role="alert" className="text-danger text-sm">
                        {rejectError}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isRejecting}
                        onClick={() => setRejectTarget(null)}
                      >
                        Volver
                      </Button>
                      <Button
                        size="sm"
                        disabled={isRejecting}
                        onClick={() => void confirmRejection()}
                      >
                        {isRejecting
                          ? "Rechazando invitación"
                          : "Confirmar rechazo"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
