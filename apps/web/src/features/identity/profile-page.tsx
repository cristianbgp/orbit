import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { ApiClientError } from "@/lib/api/fetcher";
import {
  useGetCurrentUser,
  useUpdateCurrentUser,
} from "@/lib/api/generated/identity/identity";
import { useGetTeamMember } from "@/lib/api/generated/team/team";
import { MemberIdentity } from "./member-identity";
import { AvatarColorSelector } from "./avatar-color-selector";
import { authClient } from "@/lib/auth-client";
import { studioMemberPositionLabel } from "../team/studio-member-position";

async function signOut() {
  const result = await authClient.signOut();
  if (result.error) throw new Error("Sign out failed");
}

const ALIAS_VALIDATION_ERROR =
  "El alias debe tener entre 2 y 12 letras o números, sin espacios.";
const UPDATE_ERROR = "No pudimos actualizar tu perfil. Inténtalo nuevamente.";

function roleLabel(role: string) {
  return role === "owner" ? "Propietario" : "Miembro";
}

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function isValidationError(error: unknown) {
  if (error instanceof ApiClientError) {
    return (
      error.kind === "http" && (error.status === 400 || error.status === 422)
    );
  }

  if (!error || typeof error !== "object" || !("error" in error)) return false;
  const payload = error.error;
  return (
    payload !== null &&
    typeof payload === "object" &&
    "code" in payload &&
    payload.code === "VALIDATION_ERROR"
  );
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const currentUserQuery = useGetCurrentUser();
  const updateCurrentUser = useUpdateCurrentUser();
  const currentUser = currentUserQuery.data?.user;
  const memberQuery = useGetTeamMember(currentUser?.id ?? "", {
    query: { enabled: Boolean(currentUser?.id) },
  });
  const initializedUserId = useRef<string | null>(null);
  const submissionInFlight = useRef(false);
  const [alias, setAlias] = useState("");
  const [savedAlias, setSavedAlias] = useState("");
  const [avatarColor, setAvatarColor] = useState("");
  const [savedAvatarColor, setSavedAvatarColor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && initializedUserId.current !== currentUser.id) {
      initializedUserId.current = currentUser.id;
      setAlias(currentUser.alias);
      setSavedAlias(currentUser.alias);
      setAvatarColor(currentUser.avatarColor);
      setSavedAvatarColor(currentUser.avatarColor);
    }
  }, [currentUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !currentUser ||
      updateCurrentUser.isPending ||
      submissionInFlight.current
    ) {
      return;
    }

    const value = alias.trim();
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setValidationError(null);
    setRequestError(null);
    setSuccess(null);

    try {
      await updateCurrentUser.mutateAsync({
        data: { alias: value, avatarColor },
      });
      setAlias(value);
      setSavedAlias(value);
      setSavedAvatarColor(avatarColor);
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) => {
          const key = queryKey[0];
          return (
            typeof key === "string" &&
            (key === "/api/me" ||
              key.startsWith("/api/team/") ||
              key.startsWith("/api/projects/") ||
              key.startsWith("/api/dashboard") ||
              key.startsWith("/api/my-work") ||
              key.startsWith("/api/search"))
          );
        },
      });
      setSuccess("Perfil actualizado.");
    } catch (requestError) {
      if (isValidationError(requestError)) {
        setValidationError(ALIAS_VALIDATION_ERROR);
      } else {
        setRequestError(UPDATE_ERROR);
      }
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  if (currentUserQuery.isPending) {
    return (
      <AppPage aria-label="Cargando tu perfil" className="py-7 lg:py-9">
        <div className="rounded-card bg-muted h-56 animate-pulse" />
      </AppPage>
    );
  }

  if (currentUserQuery.isError || !currentUser) {
    return (
      <AppPage className="py-7 lg:py-9">
        <section className="rounded-card border-border bg-card shadow-panel space-y-5 border p-6 sm:p-8">
          <div className="border-danger space-y-2 border-l-2 pl-4">
            <h1 className="font-display text-2xl font-semibold">
              No pudimos cargar tu perfil
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Revisa tu conexión e inténtalo nuevamente.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void currentUserQuery.refetch()}
          >
            Intentar de nuevo
          </Button>
        </section>
      </AppPage>
    );
  }

  const member = memberQuery.data?.member;
  const pending = updateCurrentUser.isPending || isSubmitting;
  const saveDisabled =
    pending ||
    (alias.trim() === savedAlias && avatarColor === savedAvatarColor);
  const displayedError = validationError ?? requestError;
  const displayedErrorId = validationError
    ? "profile-alias-validation-error"
    : "profile-alias-request-error";

  return (
    <AppPage>
      <AppPageHeader
        icon={UserRound}
        eyebrow="Cuenta"
        title="Tu perfil"
        description="Administra cómo te reconoce tu equipo dentro de Orbit."
      />

      <AppPageContent className="lg:grid-cols-[minmax(22rem,1fr)_minmax(18rem,0.72fr)]">
        <section className="rounded-card border-border bg-card shadow-panel overflow-hidden border">
          <div className="border-border border-b p-6 sm:p-8">
            <MemberIdentity
              member={{
                userId: currentUser.id,
                alias: currentUser.alias,
                avatarColor,
                fullName: currentUser.name,
                activeStudioMember: Boolean(member),
              }}
              secondary={currentUser.email}
            />
          </div>
          <form
            className="space-y-5 p-6 sm:p-8"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
                Identidad en Orbit
              </h2>
              <p className="text-muted-foreground text-sm leading-6">
                Tu alias aparece en avatares, proyectos y espacios compartidos.
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="profile-alias"
                className="block text-sm font-semibold"
              >
                Alias
              </label>
              <Input
                id="profile-alias"
                autoComplete="nickname"
                value={alias}
                aria-describedby={
                  displayedError ? displayedErrorId : "profile-alias-help"
                }
                aria-invalid={Boolean(validationError)}
                onChange={(event) => {
                  setAlias(event.target.value);
                  if (validationError) setValidationError(null);
                  if (requestError) setRequestError(null);
                  if (success) setSuccess(null);
                }}
              />
              {displayedError ? (
                <p
                  id={displayedErrorId}
                  role="alert"
                  className="rounded-control border-danger/20 bg-danger-soft text-danger border px-3 py-2 text-sm leading-5"
                >
                  {displayedError}
                </p>
              ) : (
                <p
                  id="profile-alias-help"
                  className="text-muted-foreground text-sm"
                >
                  Usa entre 2 y 12 letras o números, sin espacios.
                </p>
              )}
              {success ? (
                <p role="status" className="text-success text-sm font-medium">
                  {success}
                </p>
              ) : null}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Color del avatar</p>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  El color del texto se ajusta automáticamente para mantener el
                  contraste.
                </p>
              </div>
              <AvatarColorSelector
                value={avatarColor}
                disabled={pending}
                onChange={(value) => {
                  setAvatarColor(value);
                  if (requestError) setRequestError(null);
                  if (success) setSuccess(null);
                }}
              />
            </div>
            <Button type="submit" disabled={saveDisabled}>
              {pending ? "Guardando…" : "Guardar perfil"}
            </Button>
          </form>
        </section>

        <section className="rounded-card border-border bg-card shadow-panel h-fit overflow-hidden border">
          <div className="border-border border-b px-6 py-5">
            <h2 className="font-display text-lg font-semibold">
              Información en el estudio
            </h2>
          </div>
          {memberQuery.isPending ? (
            <div aria-label="Cargando membresía" className="space-y-3 p-6">
              <div className="rounded-control bg-muted h-12 animate-pulse" />
              <div className="rounded-control bg-muted h-12 animate-pulse" />
            </div>
          ) : memberQuery.isError || !member ? (
            <div className="space-y-4 p-6">
              <p className="text-muted-foreground text-sm leading-6">
                No pudimos cargar tu membresía del estudio.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void memberQuery.refetch()}
              >
                Intentar de nuevo
              </Button>
            </div>
          ) : (
            <dl className="divide-border divide-y">
              <ProfileFact label="Nombre completo" value={currentUser.name} />
              <ProfileFact
                label="Correo electrónico"
                value={currentUser.email}
              />
              <ProfileFact
                label="Posición"
                value={studioMemberPositionLabel(member.position)}
              />
              <ProfileFact
                label="Rol de acceso"
                value={roleLabel(member.role)}
              />
              <ProfileFact
                label="Miembro desde"
                value={formatMemberSince(member.memberSince)}
              />
            </dl>
          )}
        </section>
      </AppPageContent>
      <div className="flex">
        <Button
          variant="destructive"
          size="sm"
          className="text-danger-soft bg-danger shrink-0 hover:opacity-90"
          onClick={() => void signOut()}
        >
          Cerrar sesión
        </Button>
      </div>
    </AppPage>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 px-6 py-4">
      <dt className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
