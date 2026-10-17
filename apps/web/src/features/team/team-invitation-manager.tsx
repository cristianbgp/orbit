import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamInvitation } from "@/lib/api/generated/models";
import { authClient } from "@/lib/auth-client";
import {
  STUDIO_MEMBER_POSITION_OPTIONS,
  studioMemberPositionLabel,
  type StudioMemberPositionValue,
} from "./studio-member-position";

type RefreshProps = { onRefresh(): Promise<unknown> | unknown };
type PendingProps = RefreshProps & { invitations: TeamInvitation[] };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invitationLink(invitationId: string) {
  return `${window.location.origin}/invitations/${encodeURIComponent(invitationId)}`;
}

function expirationLabel(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function useCopyFeedback() {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  async function copyLink(link: string) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setCopyMessage("Enlace copiado.");
    } catch {
      setCopyMessage(
        "No pudimos copiarlo. Selecciona el enlace visible y cópialo manualmente.",
      );
    }
  }
  return {
    copyLink,
    copyMessage,
    clearCopyMessage: () => setCopyMessage(null),
  };
}

function InvitationLinkPanel({
  link,
  label = "Enlace de invitación",
  copyLabel,
  onCopy,
}: {
  link: string;
  label?: string;
  copyLabel?: string;
  onCopy(link: string): void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        aria-label={label}
        value={link}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button
        aria-label={copyLabel}
        variant="outline"
        size="sm"
        className="!h-11"
        onClick={() => onCopy(link)}
      >
        Copiar enlace
      </Button>
    </div>
  );
}

export function TeamInvitationForm({ onRefresh }: RefreshProps) {
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState<StudioMemberPositionValue | "">("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const { copyLink, copyMessage, clearCopyMessage } = useCopyFeedback();

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }
    if (!position) {
      setError("Selecciona una posición.");
      return;
    }
    setIsCreating(true);
    setError(null);
    clearCopyMessage();
    try {
      const result = await authClient.organization.inviteMember({
        email: normalizedEmail,
        role: "member",
        position,
      });
      if (result.error || !result.data?.id) throw result.error;
      setEmail("");
      setPosition("");
      setCreatedLink(invitationLink(result.data.id));
      await onRefresh();
    } catch {
      setError(
        "No pudimos crear la invitación. Si ya existe una pendiente, genera un nuevo enlace desde la lista.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => void createInvitation(event)}
      >
        <label className="block space-y-2 text-sm font-medium">
          <span>Correo del nuevo miembro</span>
          <Input
            type="email"
            value={email}
            disabled={isCreating}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="persona@estudio.pe"
            autoComplete="email"
          />
        </label>
        <div className="space-y-2 text-sm font-medium">
          <span id="invitation-position-label">Posición</span>
          <Select
            value={position}
            disabled={isCreating}
            onValueChange={(value) => {
              setPosition(value as StudioMemberPositionValue);
              setError(null);
            }}
          >
            <SelectTrigger
              aria-labelledby="invitation-position-label"
              aria-required="true"
              className="bg-background h-11 w-full"
            >
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {STUDIO_MEMBER_POSITION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isCreating}>
          {isCreating ? "Creando invitación…" : "Invitar miembro"}
        </Button>
      </form>
      {createdLink ? (
        <div className="rounded-control border-primary/30 bg-info-soft space-y-3 border p-4">
          <div>
            <p className="text-sm font-semibold">Enlace listo para compartir</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Este enlace vence en 48 horas.
            </p>
          </div>
          <InvitationLinkPanel
            link={createdLink}
            onCopy={(link) => void copyLink(link)}
          />
        </div>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground text-xs">
        {copyMessage}
      </p>
    </div>
  );
}

export function PendingTeamInvitations({
  invitations,
  onRefresh,
}: PendingProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacementLink, setReplacementLink] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TeamInvitation | null>(null);
  const { copyLink, copyMessage, clearCopyMessage } = useCopyFeedback();

  async function replaceInvitation(invitation: TeamInvitation) {
    if (!invitation.position) {
      setError(
        "Esta invitación no tiene posición. Cancélala y crea una nueva.",
      );
      return;
    }
    setBusyId(invitation.id);
    setError(null);
    clearCopyMessage();
    try {
      const result = await authClient.organization.inviteMember({
        email: invitation.email,
        role: "member",
        position: invitation.position,
        resend: true,
      });
      if (result.error || !result.data?.id) throw result.error;
      setReplacementLink(invitationLink(result.data.id));
      await onRefresh();
    } catch {
      setError("No pudimos generar un nuevo enlace. Inténtalo nuevamente.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelInvitation() {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    setError(null);
    try {
      const result = await authClient.organization.cancelInvitation({
        invitationId: cancelTarget.id,
      });
      if (result.error) throw result.error;
      await onRefresh();
      setCancelTarget(null);
    } catch {
      setError("No pudimos cancelar la invitación. Inténtalo nuevamente.");
    } finally {
      setBusyId(null);
    }
  }

  if (invitations.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <h3 className="font-display text-lg font-semibold">
          No hay invitaciones pendientes
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Las nuevas invitaciones aparecerán aquí hasta que sean aceptadas o
          canceladas.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="border-danger text-danger mx-5 mt-5 border-l-2 pl-3 text-sm"
        >
          {error}
        </p>
      ) : null}
      {replacementLink ? (
        <div className="border-border bg-info-soft rounded-control mx-5 mt-5 space-y-2 border p-4">
          <p className="text-sm font-semibold">Nuevo enlace listo</p>
          <InvitationLinkPanel
            link={replacementLink}
            onCopy={(link) => void copyLink(link)}
          />
        </div>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground px-5 pt-3 text-xs">
        {copyMessage}
      </p>
      <div className="divide-border divide-y">
        {invitations.map((invitation) => {
          const link = invitationLink(invitation.id);
          const isExpired =
            new Date(invitation.expiresAt).getTime() <= Date.now();
          return (
            <article
              key={invitation.id}
              className="space-y-4 px-5 py-5 sm:px-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold break-all">
                    {invitation.email}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {isExpired
                      ? "Enlace vencido"
                      : `Vence el ${expirationLabel(invitation.expiresAt)}`}
                  </p>
                  <p className="mt-1 text-xs font-medium">
                    {studioMemberPositionLabel(invitation.position)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="!h-11 lg:!h-8"
                    disabled={busyId !== null}
                    onClick={() => void replaceInvitation(invitation)}
                  >
                    Generar nuevo enlace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!h-11 lg:!h-8"
                    disabled={busyId !== null}
                    onClick={() => setCancelTarget(invitation)}
                  >
                    Cancelar invitación
                  </Button>
                </div>
              </div>
              {!isExpired ? (
                <InvitationLinkPanel
                  link={link}
                  label={`Enlace para ${invitation.email}`}
                  copyLabel={`Copiar enlace de ${invitation.email}`}
                  onCopy={(value) => void copyLink(value)}
                />
              ) : null}
            </article>
          );
        })}
      </div>
      {cancelTarget ? (
        <div className="border-border bg-muted/40 space-y-3 border-t p-5 sm:p-6">
          <p className="text-sm font-semibold">
            Cancelar la invitación para {cancelTarget.email}
          </p>
          <p className="text-muted-foreground text-sm">
            El enlace dejará de funcionar inmediatamente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="!h-11 lg:!h-8"
              disabled={busyId !== null}
              onClick={() => setCancelTarget(null)}
            >
              Volver
            </Button>
            <Button
              size="sm"
              className="!h-11 lg:!h-8"
              disabled={busyId !== null}
              onClick={() => void cancelInvitation()}
            >
              Confirmar cancelación
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
