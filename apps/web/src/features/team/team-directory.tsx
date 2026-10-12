import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberIdentity } from "@/features/identity/member-identity";
import type { StudioMember } from "@/lib/api/generated/models";
import {
  STUDIO_MEMBER_POSITION_OPTIONS,
  studioMemberPositionLabel,
  type StudioMemberPositionValue,
} from "./studio-member-position";

export type TeamMember = StudioMember;

function roleLabel(role: string) {
  return role === "owner" ? "Propietario" : "Miembro";
}

type TeamDirectoryProps = {
  members: TeamMember[];
  canManage?: boolean;
  onRemove?(member: TeamMember): Promise<void> | void;
  onUpdatePosition?(
    member: TeamMember,
    position: StudioMemberPositionValue,
  ): Promise<void> | void;
  onRecover?(member: TeamMember): void;
};

export function TeamDirectory({
  members,
  canManage = false,
  onRemove,
  onUpdatePosition,
  onRecover,
}: TeamDirectoryProps) {
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [selectedPosition, setSelectedPosition] =
    useState<StudioMemberPositionValue>("partner");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function savePosition() {
    if (!editTarget || !onUpdatePosition) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await onUpdatePosition(editTarget, selectedPosition);
      setEditTarget(null);
    } catch {
      setUpdateError("No pudimos cambiar la posición. Inténtalo nuevamente.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function confirmRemoval() {
    if (!removeTarget || !onRemove) return;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      await onRemove(removeTarget);
      setRemoveTarget(null);
    } catch {
      setRemoveError("No pudimos quitar a este miembro. Inténtalo nuevamente.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <>
      <div
        role="table"
        aria-label="Directorio de miembros"
        className="divide-border divide-y lg:grid lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_minmax(10rem,auto)] xl:grid-cols-[minmax(15rem,1fr)_10rem_9rem_minmax(13rem,auto)]"
      >
        <div
          role="row"
          className="border-border bg-muted/25 text-muted-foreground hidden px-5 py-2.5 text-xs font-semibold lg:col-span-4 lg:grid lg:grid-cols-subgrid lg:items-center lg:gap-4"
        >
          <span role="columnheader">Miembro</span>
          <span role="columnheader">Posición</span>
          <span role="columnheader">Acceso</span>
          <span role="columnheader" className="text-right">
            Acciones
          </span>
        </div>
        {members.map((member) => (
          <article
            key={member.memberId}
            role="row"
            aria-label={member.name}
            className="space-y-3 px-4 py-4 sm:px-5 lg:col-span-4 lg:grid lg:grid-cols-subgrid lg:space-y-0 lg:gap-x-4"
          >
            <div
              role="presentation"
              className="grid min-w-0 gap-3 lg:col-span-4 lg:grid-cols-subgrid lg:items-center lg:gap-4"
            >
              <div role="cell" className="min-w-0">
                <MemberIdentity
                  member={{
                    userId: member.userId,
                    alias: member.alias,
                    avatarColor: member.avatarColor,
                    fullName: member.name,
                    activeStudioMember: true,
                  }}
                  to={`/team/${member.userId}`}
                  secondary={member.email}
                />
              </div>
              <div
                role="cell"
                className="flex items-center justify-between gap-3 lg:block"
              >
                <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                  Posición
                </span>
                <span className="text-sm font-medium">
                  {studioMemberPositionLabel(member.position)}
                </span>
              </div>
              <div
                role="cell"
                className="flex items-center justify-between gap-3 lg:block"
              >
                <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                  Acceso
                </span>
                <span className="bg-muted text-muted-foreground w-fit rounded-md px-2.5 py-1 text-xs font-medium">
                  {roleLabel(member.role)}
                </span>
              </div>
              <div
                role="cell"
                className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 lg:justify-end"
              >
                {canManage && onUpdatePosition ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="!h-11 lg:!h-8"
                    aria-label={`Cambiar posición de ${member.name}`}
                    onClick={() => {
                      setUpdateError(null);
                      setSelectedPosition(member.position ?? "partner");
                      setEditTarget(member);
                    }}
                  >
                    Cambiar posición
                  </Button>
                ) : null}
                {canManage && onRecover ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!h-11 lg:!h-8"
                    aria-label={`Generar enlace de recuperación de ${member.name}`}
                    onClick={() => onRecover(member)}
                  >
                    Recuperar acceso
                  </Button>
                ) : null}
                {canManage && member.role !== "owner" && onRemove ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!h-11 lg:!h-8"
                    aria-label={`Quitar a ${member.name}`}
                    onClick={() => {
                      setRemoveError(null);
                      setRemoveTarget(member);
                    }}
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
            {editTarget?.memberId === member.memberId ? (
              <div role="cell" className="pt-3 lg:col-span-4">
                <div
                  role="group"
                  aria-label={`Editar posición de ${member.name}`}
                  className="rounded-control border-border bg-muted/30 flex flex-col gap-3 border p-3 sm:flex-row sm:items-end"
                >
                  <div className="min-w-0 flex-1 space-y-2 text-sm font-medium">
                    <span id={`member-position-${member.memberId}`}>
                      Posición de {member.name}
                    </span>
                    <Select
                      value={selectedPosition}
                      disabled={isUpdating}
                      onValueChange={(value) =>
                        setSelectedPosition(value as StudioMemberPositionValue)
                      }
                    >
                      <SelectTrigger
                        aria-labelledby={`member-position-${member.memberId}`}
                        className="bg-background w-full sm:max-w-56"
                      >
                        <SelectValue />
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="!h-11 lg:!h-8"
                      disabled={isUpdating}
                      onClick={() => setEditTarget(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="!h-11 lg:!h-8"
                      disabled={isUpdating}
                      onClick={() => void savePosition()}
                    >
                      {isUpdating ? "Guardando…" : "Guardar posición"}
                    </Button>
                  </div>
                  {updateError ? (
                    <p role="alert" className="text-danger text-sm">
                      {updateError}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {removeTarget ? (
        <div className="bg-muted/40 space-y-3 p-5">
          <p className="text-sm font-semibold">Quitar a {removeTarget.name}</p>
          <p className="text-muted-foreground text-sm">
            {removeTarget.name} perderá el acceso al estudio. Su participación
            anterior en proyectos permanecerá en el historial.
          </p>
          {removeError ? (
            <p role="alert" className="text-danger text-sm">
              {removeError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="!h-11 lg:!h-8"
              disabled={isRemoving}
              onClick={() => setRemoveTarget(null)}
            >
              Volver
            </Button>
            <Button
              size="sm"
              className="!h-11 lg:!h-8"
              disabled={isRemoving}
              onClick={() => void confirmRemoval()}
            >
              Confirmar retiro
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
