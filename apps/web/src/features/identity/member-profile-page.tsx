import { Link, useParams } from "react-router-dom";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { ApiClientError } from "@/lib/api/fetcher";
import { useGetTeamMember } from "@/lib/api/generated/team/team";
import { MemberIdentity } from "./member-identity";
import { studioMemberPositionLabel } from "../team/studio-member-position";

function roleLabel(role: string) {
  return role === "owner" ? "Propietario" : "Miembro";
}

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function MemberProfilePage() {
  const { userId = "" } = useParams();
  const memberQuery = useGetTeamMember(userId, {
    query: { enabled: Boolean(userId) },
  });

  if (memberQuery.isPending) {
    return (
      <AppPage aria-label="Cargando perfil de miembro" className="py-7 lg:py-9">
        <div className="rounded-card bg-muted h-44 animate-pulse" />
      </AppPage>
    );
  }

  const memberUnavailable =
    !memberQuery.data?.member &&
    (!memberQuery.isError ||
      (memberQuery.error instanceof ApiClientError &&
        memberQuery.error.kind === "http" &&
        memberQuery.error.status === 404));

  if (memberUnavailable) {
    return (
      <AppPage className="py-7 lg:py-9">
        <section className="rounded-card border-border bg-card shadow-panel space-y-5 border p-6 sm:p-8">
          <div className="border-danger space-y-2 border-l-2 pl-4">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.025em]">
              Perfil no disponible
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Este perfil no está disponible en tu estudio.
            </p>
          </div>
        </section>
      </AppPage>
    );
  }

  if (memberQuery.isError) {
    return (
      <AppPage className="py-7 lg:py-9">
        <section className="rounded-card border-border bg-card shadow-panel space-y-5 border p-6 sm:p-8">
          <div className="border-danger space-y-2 border-l-2 pl-4">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.025em]">
              No pudimos cargar el perfil
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Revisa tu conexión e inténtalo nuevamente.
            </p>
          </div>
          <Button variant="outline" onClick={() => void memberQuery.refetch()}>
            Intentar de nuevo
          </Button>
        </section>
      </AppPage>
    );
  }

  const { member } = memberQuery.data;

  return (
    <AppPage>
      <AppPageHeader
        icon={Users}
        eyebrow="Estudio"
        title="Perfil de miembro"
        description="Consulta la identidad y membresía de esta persona en el estudio."
      />

      <AppPageContent>
        <section className="rounded-card border-border bg-card shadow-panel overflow-hidden border">
          <div className="border-border flex flex-col gap-5 border-b p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <MemberIdentity
              member={{
                userId: member.userId,
                alias: member.alias,
                avatarColor: member.avatarColor,
                fullName: member.name,
                activeStudioMember: true,
              }}
              secondary={roleLabel(member.role)}
            />
            {member.isCurrentUser ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-info-soft text-info rounded-full px-3 py-1.5 text-xs font-semibold">
                  Este eres tú
                </span>
                <Link
                  to="/profile"
                  className="text-primary hover:text-primary-strong focus-visible:ring-ring text-sm font-semibold outline-none focus-visible:ring-2"
                >
                  Editar tu perfil
                </Link>
              </div>
            ) : null}
          </div>

          <dl className="bg-border grid gap-px sm:grid-cols-2">
            <ProfileFact label="Alias" value={member.alias} />
            <ProfileFact label="Nombre completo" value={member.name} />
            <ProfileFact label="Correo electrónico" value={member.email} />
          </dl>
          <div className="border-border border-y px-6 py-4 sm:px-8">
            <h2 className="font-display text-lg font-semibold">
              Información en el estudio
            </h2>
          </div>
          <dl className="bg-border grid gap-px sm:grid-cols-2">
            <ProfileFact
              label="Posición"
              value={studioMemberPositionLabel(member.position)}
            />
            <ProfileFact label="Rol de acceso" value={roleLabel(member.role)} />
            <ProfileFact
              label="Miembro desde"
              value={formatMemberSince(member.memberSince)}
            />
          </dl>
        </section>
      </AppPageContent>
    </AppPage>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card space-y-1 px-6 py-5 sm:px-8">
      <dt className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
        {label}
      </dt>
      <dd className="text-foreground text-sm font-medium break-words">
        {value}
      </dd>
    </div>
  );
}
