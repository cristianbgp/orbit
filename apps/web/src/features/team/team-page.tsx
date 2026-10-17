import { useEffect, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { authClient } from "@/lib/auth-client";
import {
  getGetTeamMemberQueryKey,
  getListPendingTeamInvitationsQueryKey,
  getListTeamMembersQueryKey,
  useListPendingTeamInvitations,
  useListTeamMembers,
  useRemoveTeamMember,
  useUpdateTeamMemberPosition,
} from "@/lib/api/generated/team/team";
import { TeamDirectory, type TeamMember } from "./team-directory";
import { MemberPasswordRecoveryDialog } from "./member-password-recovery-dialog";
import {
  PendingTeamInvitations,
  TeamInvitationForm,
} from "./team-invitation-manager";
import {
  STUDIO_MEMBER_POSITION_OPTIONS,
  type StudioMemberPositionValue,
} from "./studio-member-position";

const PAGE_SIZE = 25;
type PositionFilter = StudioMemberPositionValue | "all";

export function TeamPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<PositionFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [recoveryTarget, setRecoveryTarget] = useState<TeamMember | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300).trim();
  const activeMember = authClient.useActiveMember();
  const isOwner = activeMember.data?.role === "owner";

  useEffect(() => setPage(1), [debouncedSearch]);

  const memberParams = {
    page,
    pageSize: PAGE_SIZE,
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
    ...(position !== "all" ? { position } : {}),
  };
  const membersQuery = useListTeamMembers(memberParams, {
    query: { placeholderData: keepPreviousData },
  });
  const invitationQuery = useListPendingTeamInvitations({
    query: { enabled: isOwner },
  });
  const removeMemberMutation = useRemoveTeamMember();
  const updatePositionMutation = useUpdateTeamMemberPosition();
  const members = membersQuery.data?.members ?? [];
  const total = membersQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, membersQuery.data?.pagination.totalPages ?? 0);
  const invitations = invitationQuery.data?.invitations ?? [];
  const hasFilters = Boolean(debouncedSearch) || position !== "all";

  async function refreshInvitations() {
    await queryClient.invalidateQueries({
      queryKey: getListPendingTeamInvitationsQueryKey(),
    });
  }

  async function removeMember(member: TeamMember) {
    await removeMemberMutation.mutateAsync({ memberId: member.memberId });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getGetTeamMemberQueryKey(member.userId),
      }),
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] }),
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          typeof queryKey[0] === "string" &&
          queryKey[0].startsWith("/api/projects/"),
      }),
    ]);
  }

  async function updateMemberPosition(
    member: TeamMember,
    nextPosition: StudioMemberPositionValue,
  ) {
    await updatePositionMutation.mutateAsync({
      memberId: member.memberId,
      data: { position: nextPosition },
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getGetTeamMemberQueryKey(member.userId),
      }),
    ]);
  }

  function clearFilters() {
    setSearch("");
    setPosition("all");
    setPage(1);
  }

  const memberDirectory = (
    <section
      aria-labelledby="team-directory-title"
      aria-busy={membersQuery.isPlaceholderData}
      className="rounded-card border-border bg-card shadow-panel min-w-0 overflow-hidden border"
    >
      <div className="border-border flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <label className="min-w-0 flex-1 space-y-2 text-sm font-medium">
          <span className="sr-only">Buscar miembros</span>
          <Input
            type="search"
            aria-label="Buscar miembros"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o alias"
          />
        </label>
        <div className="w-full space-y-2 text-sm font-medium sm:w-56">
          <span className="sr-only" id="team-position-filter-label">
            Filtrar por posición
          </span>
          <Select
            value={position}
            onValueChange={(value) => {
              setPosition(value as PositionFilter);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-labelledby="team-position-filter-label"
              className="bg-background h-11 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las posiciones</SelectItem>
              {STUDIO_MEMBER_POSITION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {membersQuery.isPending ? (
        <div aria-label="Cargando equipo" className="space-y-3 p-5">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="rounded-control bg-muted h-16 animate-pulse"
            />
          ))}
        </div>
      ) : membersQuery.isError ? (
        <div className="space-y-4 p-6">
          <div className="border-danger space-y-2 border-l-2 pl-4">
            <h3 className="font-display text-lg font-semibold">
              No pudimos cargar el equipo
            </h3>
            <p className="text-muted-foreground text-sm leading-6">
              Revisa tu conexión e inténtalo nuevamente.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void membersQuery.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : members.length === 0 && hasFilters ? (
        <div className="px-6 py-14 text-center">
          <h3 className="font-display text-lg font-semibold">
            No encontramos miembros
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Prueba con otro nombre o elimina los filtros aplicados.
          </p>
          <Button
            className="mt-5"
            variant="outline"
            size="sm"
            onClick={clearFilters}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : members.length === 0 ? (
        <div className="p-8 text-center">
          <h3 className="font-display text-lg font-semibold">
            Aún no hay miembros para mostrar
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            El equipo aparecerá aquí cuando tenga acceso al estudio.
          </p>
        </div>
      ) : (
        <TeamDirectory
          members={members}
          canManage={isOwner}
          onRemove={removeMember}
          onUpdatePosition={updateMemberPosition}
          onRecover={setRecoveryTarget}
        />
      )}

      {!membersQuery.isPending && !membersQuery.isError && totalPages > 1 ? (
        <nav
          aria-label="Paginación del equipo"
          className="border-border flex items-center justify-between gap-3 border-t px-5 py-4"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || membersQuery.isPlaceholderData}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-xs font-medium">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || membersQuery.isPlaceholderData}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente
          </Button>
        </nav>
      ) : null}
    </section>
  );

  const invitationDirectory = (
    <section className="rounded-card border-border bg-card shadow-panel min-w-0 overflow-hidden border">
      {invitationQuery.isPending ? (
        <div aria-label="Cargando invitaciones" className="space-y-3 p-5">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="rounded-control bg-muted h-24 animate-pulse"
            />
          ))}
        </div>
      ) : invitationQuery.isError ? (
        <div className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">
            No pudimos cargar las invitaciones
          </h2>
          <Button
            variant="outline"
            onClick={() => void invitationQuery.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : (
        <PendingTeamInvitations
          invitations={invitations}
          onRefresh={refreshInvitations}
        />
      )}
    </section>
  );

  return (
    <AppPage>
      <AppPageHeader
        icon={Users}
        eyebrow="Estudio"
        title="Equipo"
        description="Administra las personas, posiciones e invitaciones de tu estudio."
        actions={
          isOwner ? (
            <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
              <SheetTrigger asChild>
                <Button className="h-11 w-full active:translate-y-px sm:w-auto lg:h-9">
                  Invitar miembro
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto overscroll-contain sm:max-w-md">
                <SheetHeader className="border-border border-b pr-16">
                  <SheetTitle className="font-display text-xl">
                    Invitar a un miembro
                  </SheetTitle>
                  <SheetDescription>
                    Crea un enlace privado que vence en 48 horas y compártelo
                    manualmente.
                  </SheetDescription>
                </SheetHeader>
                <div className="p-4 sm:p-6">
                  <TeamInvitationForm onRefresh={refreshInvitations} />
                </div>
              </SheetContent>
            </Sheet>
          ) : null
        }
      />

      <AppPageContent>
        {isOwner ? (
          <Tabs defaultValue="members" className="min-w-0">
            <TabsList
              variant="line"
              aria-label="Secciones del equipo"
              className="border-border !h-11 w-full justify-start border-b px-0 pb-2 sm:w-fit lg:!h-9"
            >
              <TabsTrigger value="members" className="flex-none px-3">
                Miembros{" "}
                <span className="bg-muted rounded-md px-1.5 py-0.5 text-xs">
                  {total}
                </span>
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex-none px-3">
                Invitaciones{" "}
                <span className="bg-muted rounded-md px-1.5 py-0.5 text-xs">
                  {invitations.length}
                </span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-4 min-w-0">
              {memberDirectory}
            </TabsContent>
            <TabsContent value="invitations" className="mt-4 min-w-0">
              {invitationDirectory}
            </TabsContent>
          </Tabs>
        ) : (
          memberDirectory
        )}
      </AppPageContent>
      <MemberPasswordRecoveryDialog
        member={recoveryTarget}
        open={recoveryTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRecoveryTarget(null);
        }}
      />
    </AppPage>
  );
}
