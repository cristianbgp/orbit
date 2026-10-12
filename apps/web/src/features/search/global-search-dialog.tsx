import type { ReactNode } from "react";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  FolderKanban,
  ListTodo,
  MessageCircleQuestion,
  Plus,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { AliasAvatar } from "@/features/identity/alias-avatar";
import { getCaseLabel } from "@/features/cases/case-presenters";
import { PROJECT_STATUS_LABELS } from "@/features/projects/project-labels";
import { PROJECT_TASK_STATUS_LABELS } from "@/features/projects/project-task-labels";
import type { GlobalSearchResponse } from "@/lib/api/generated/models";

type GlobalSearchDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  trigger?: ReactNode;
  query: string;
  onQueryChange(query: string): void;
  normalizedQuery: string;
  debouncedQuery: string;
  enabled: boolean;
  isCurrentQuery: boolean;
  data: GlobalSearchResponse | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry(): void;
  onSelect(destination: string): void;
  helpAssistantEnabled: boolean;
};

const navigation = [
  { label: "Proyectos", destination: "/projects", icon: FolderKanban },
  { label: "Casos", destination: "/cases", icon: BriefcaseBusiness },
  { label: "Mi trabajo", destination: "/my-work", icon: ListTodo },
  { label: "Actividad", destination: "/activity", icon: Activity },
  { label: "Clientes", destination: "/clients", icon: Building2 },
  { label: "Equipo", destination: "/team", icon: Users },
];

function ResultText({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{title}</span>
      <span className="text-muted-foreground block truncate text-xs">
        {detail}
      </span>
    </span>
  );
}

function memberRoleLabel(role: string) {
  if (role === "owner") return "Propietario";
  if (role === "admin") return "Administrador";
  return "Miembro";
}

function hasResults(data: GlobalSearchResponse | undefined) {
  return Boolean(
    data &&
    (data.cases.length ||
      data.projects.length ||
      data.tasks.length ||
      data.clients.length ||
      data.members.length),
  );
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
  trigger,
  query,
  onQueryChange,
  normalizedQuery,
  debouncedQuery,
  enabled,
  isCurrentQuery,
  data,
  isPending,
  isFetching,
  isError,
  onRetry,
  onSelect,
  helpAssistantEnabled,
}: GlobalSearchDialogProps) {
  const waitingForDebounce = !isCurrentQuery;
  const showDefault =
    normalizedQuery.length < 2 ||
    (waitingForDebounce && debouncedQuery.length < 2);
  const searching =
    normalizedQuery.length >= 2 &&
    !waitingForDebounce &&
    (isPending || (isFetching && !data));
  const showRemote = enabled && !searching;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      shouldFilter={false}
      loop
      title="Buscar en Orbit"
      description="Encuentra casos, proyectos, tareas, clientes y miembros del estudio."
      showCloseButton
      className="top-[max(1rem,env(safe-area-inset-top))] flex max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] translate-y-0 flex-col gap-0 sm:max-w-2xl [&_[data-slot=command-input-wrapper]]:pr-12"
    >
      <CommandInput
        aria-label="Buscar en Orbit"
        placeholder="Buscar casos, proyectos, tareas, clientes o miembros…"
        value={query}
        onValueChange={onQueryChange}
      />
      <CommandList className="max-h-[none] min-h-0 flex-1 overscroll-contain">
        {showDefault ? (
          <>
            <CommandGroup heading="Acciones rápidas">
              <CommandItem
                value="action-new-project"
                onSelect={() => onSelect("/projects/new")}
              >
                <Plus aria-hidden="true" />
                Nuevo proyecto
              </CommandItem>
              <CommandItem
                value="action-new-case"
                onSelect={() => onSelect("/cases/new")}
              >
                <Plus aria-hidden="true" />
                Nuevo caso
              </CommandItem>
              <CommandItem
                value="action-new-client"
                onSelect={() => onSelect("/clients?action=create")}
              >
                <Plus aria-hidden="true" />
                Nuevo cliente
              </CommandItem>
              {helpAssistantEnabled ? (
                <CommandItem
                  value="action-ask-orbit"
                  onSelect={() => onSelect("/help/ask")}
                >
                  <MessageCircleQuestion aria-hidden="true" />
                  Preguntar a Orbit
                </CommandItem>
              ) : null}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Navegación">
              {navigation.map(({ label, destination, icon: Icon }) => (
                <CommandItem
                  key={destination}
                  value={`navigation-${destination}`}
                  onSelect={() => onSelect(destination)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : searching ? (
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground px-4 py-8 text-center text-sm"
          >
            Buscando…
          </p>
        ) : showRemote && isError ? (
          <div
            role="alert"
            className="border-danger/20 bg-danger-soft mx-3 my-4 rounded-md border p-4"
          >
            <p className="text-sm font-semibold">
              No pudimos realizar la búsqueda
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Revisa tu conexión e inténtalo nuevamente.
            </p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={onRetry}
            >
              Reintentar
            </Button>
          </div>
        ) : showRemote && hasResults(data) ? (
          <>
            {data!.cases.length ? (
              <CommandGroup heading="Casos">
                {data!.cases.map((legalCase) => (
                  <CommandItem
                    key={legalCase.id}
                    value={`case-${legalCase.id}`}
                    onSelect={() => onSelect(`/cases/${legalCase.id}`)}
                  >
                    <BriefcaseBusiness aria-hidden="true" />
                    <ResultText
                      title={legalCase.identification}
                      detail={`${legalCase.client.name} · ${getCaseLabel("type", legalCase.type)} · ${getCaseLabel("status", legalCase.status)}`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data!.projects.length ? (
              <CommandGroup heading="Proyectos">
                {data!.projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project-${project.id}`}
                    onSelect={() => onSelect(`/projects/${project.id}`)}
                  >
                    <FolderKanban aria-hidden="true" />
                    <ResultText
                      title={project.name}
                      detail={`${project.client.name} · ${PROJECT_STATUS_LABELS[project.status]}`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data!.tasks.length ? (
              <CommandGroup heading="Tareas">
                {data!.tasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task-${task.id}`}
                    onSelect={() =>
                      onSelect(`/projects/${task.project.id}?task=${task.id}`)
                    }
                  >
                    <ListTodo aria-hidden="true" />
                    <ResultText
                      title={task.title}
                      detail={`${task.project.name} · ${task.client.name} · ${task.stage.name} · ${PROJECT_TASK_STATUS_LABELS[task.status]}`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data!.clients.length ? (
              <CommandGroup heading="Clientes">
                {data!.clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() => onSelect(`/clients?client=${client.id}`)}
                  >
                    <Building2 aria-hidden="true" />
                    <ResultText
                      title={client.name}
                      detail={`${client.type === "company" ? "Empresa" : "Persona"}${client.documentNumber ? ` · ${client.documentNumber}` : ""}`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data!.members.length ? (
              <CommandGroup heading="Miembros">
                {data!.members.map((member) => (
                  <CommandItem
                    key={member.userId}
                    value={`member-${member.userId}`}
                    onSelect={() => onSelect(`/team/${member.userId}`)}
                  >
                    <AliasAvatar
                      userId={member.userId}
                      alias={member.alias}
                      avatarColor={member.avatarColor}
                      fullName={member.name}
                      size="sm"
                    />
                    <ResultText
                      title={member.alias}
                      detail={`${member.name} · ${memberRoleLabel(member.role)}`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        ) : showRemote ? (
          <CommandEmpty>
            No encontramos resultados para “{debouncedQuery}”
          </CommandEmpty>
        ) : null}
      </CommandList>
      <footer
        aria-label="Atajos de búsqueda"
        className="border-border bg-muted/35 text-muted-foreground flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-[0.7rem]"
      >
        <span className="inline-flex items-center gap-1.5">
          <kbd className="text-foreground font-mono font-semibold">↑↓</kbd>
          Navegar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="text-foreground font-mono font-semibold">Enter</kbd>
          Abrir
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="text-foreground font-mono font-semibold">Esc</kbd>
          Cerrar
        </span>
      </footer>
    </CommandDialog>
  );
}
