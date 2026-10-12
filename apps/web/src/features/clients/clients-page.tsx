import { useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import {
  getGetClientQueryKey,
  getListClientsQueryKey,
  useCreateClient,
  useGetClient,
  useListClients,
  useUpdateClient,
} from "@/lib/api/generated/clients/clients";
import type { Client, ClientInput } from "@/lib/api/generated/models";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { ClientForm } from "./client-form";

const PAGE_SIZE = 25;

type EditorState =
  { mode: "closed" } | { mode: "create" } | { mode: "edit"; client: Client };

function ClientKind({ type }: { type: Client["type"] }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium">
      {type === "person" ? "Persona" : "Empresa"}
    </span>
  );
}

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const creating = searchParams.get("action") === "create";
  const selectedClientId = creating ? null : searchParams.get("client");
  const normalizedSearch = useDebouncedValue(search).trim();
  const clientsQuery = useListClients(
    {
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
      page,
      pageSize: PAGE_SIZE,
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const selectedClientQuery = useGetClient(selectedClientId ?? "", {
    query: { enabled: Boolean(selectedClientId) },
  });
  const clients = clientsQuery.data?.clients ?? [];
  const pagination = clientsQuery.data?.pagination;
  const selectedClient = selectedClientQuery.data?.client;
  const editor: EditorState = creating
    ? { mode: "create" }
    : selectedClient
      ? { mode: "edit", client: selectedClient }
      : { mode: "closed" };
  const isEditorOpen = creating || Boolean(selectedClientId);

  function updateEditorParams(
    update: (next: URLSearchParams) => void,
    options?: { replace?: boolean },
  ) {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, options);
  }

  function openCreate() {
    updateEditorParams((next) => {
      next.delete("client");
      next.set("action", "create");
    });
  }

  function openClient(clientId: string, options?: { replace?: boolean }) {
    updateEditorParams((next) => {
      next.delete("action");
      next.set("client", clientId);
    }, options);
  }

  function closeEditor() {
    updateEditorParams((next) => {
      next.delete("action");
      next.delete("client");
    });
  }

  async function refreshList() {
    await queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
  }

  async function createClient(input: ClientInput) {
    const result = await createMutation.mutateAsync({ data: input });
    await refreshList();
    openClient(result.client.id, { replace: true });
  }

  async function updateClient(input: ClientInput) {
    if (editor.mode !== "edit") return;
    const result = await updateMutation.mutateAsync({
      clientId: editor.client.id,
      data: input,
    });
    await refreshList();
    queryClient.setQueryData(getGetClientQueryKey(result.client.id), {
      client: result.client,
    });
  }

  return (
    <AppPage>
      <AppPageHeader
        icon={Building2}
        eyebrow="Directorio"
        title="Clientes"
        description="Centraliza la información básica de personas y empresas de tu estudio."
        actions={
          <Button
            className="w-full active:translate-y-px sm:w-auto"
            onClick={openCreate}
          >
            Nuevo cliente
          </Button>
        }
      />

      <AppPageContent className="lg:grid-cols-[minmax(15rem,0.8fr)_minmax(20rem,1.2fr)] xl:grid-cols-[minmax(19rem,0.84fr)_minmax(28rem,1.16fr)]">
        <section
          aria-labelledby="client-list-title"
          aria-busy={clientsQuery.isPlaceholderData}
          className={cn(
            "rounded-card border-border bg-card shadow-panel min-w-0 overflow-hidden border",
            isEditorOpen && "hidden lg:block",
          )}
        >
          <div className="border-border space-y-4 border-b p-5">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="client-list-title"
                className="font-display text-lg font-semibold"
              >
                Todos los clientes
              </h2>
              {!clientsQuery.isPending && !clientsQuery.isError ? (
                <span className="text-muted-foreground text-xs font-medium">
                  {pagination?.total ?? 0}{" "}
                  {pagination?.total === 1 ? "registro" : "registros"}
                </span>
              ) : null}
            </div>
            <label htmlFor="client-search" className="sr-only">
              Buscar clientes
            </label>
            <Input
              id="client-search"
              type="search"
              placeholder="Buscar por nombre o documento"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {clientsQuery.isPlaceholderData ? (
              <p className="text-muted-foreground text-xs">Actualizando…</p>
            ) : null}
          </div>

          {clientsQuery.isPending ? (
            <div aria-label="Cargando clientes" className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="rounded-control bg-muted h-17 animate-pulse"
                />
              ))}
            </div>
          ) : clientsQuery.isError ? (
            <div className="space-y-4 p-6">
              <div className="border-danger space-y-2 border-l-2 pl-4">
                <h3 className="font-display text-lg font-semibold">
                  No pudimos cargar tus clientes
                </h3>
                <p className="text-muted-foreground text-sm leading-6">
                  Revisa tu conexión e inténtalo nuevamente.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void clientsQuery.refetch()}
              >
                Intentar de nuevo
              </Button>
            </div>
          ) : clients.length === 0 ? (
            <div className="space-y-5 p-7 text-center sm:p-10">
              <div className="mx-auto max-w-sm space-y-2">
                <h3 className="font-display text-xl font-semibold tracking-[-0.025em]">
                  {normalizedSearch
                    ? "No encontramos coincidencias"
                    : "Tu directorio empieza aquí"}
                </h3>
                <p className="text-muted-foreground text-sm leading-6">
                  {normalizedSearch
                    ? "Prueba con otro nombre o número de documento."
                    : "Agrega una persona o empresa para comenzar a organizar el trabajo del estudio."}
                </p>
              </div>
              {normalizedSearch ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearch("")}
                >
                  Limpiar búsqueda
                </Button>
              ) : (
                <Button onClick={openCreate}>Crear primer cliente</Button>
              )}
            </div>
          ) : (
            <div className="divide-border divide-y">
              {clients.map((client) => {
                const selected =
                  editor.mode === "edit" && editor.client.id === client.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    className={cn(
                      "hover:bg-muted/70 focus-visible:ring-ring flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset",
                      selected && "bg-info-soft",
                    )}
                    onClick={() => openClient(client.id)}
                  >
                    <span className="min-w-0 space-y-1">
                      <span className="block truncate text-sm font-semibold">
                        {client.name}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {client.documentNumber ??
                          client.email ??
                          "Sin datos de contacto"}
                      </span>
                    </span>
                    <ClientKind type={client.type} />
                  </button>
                );
              })}
            </div>
          )}

          {!clientsQuery.isPending &&
          !clientsQuery.isError &&
          pagination &&
          pagination.totalPages > 1 ? (
            <nav
              aria-label="Paginación de clientes"
              className="border-border flex items-center justify-between gap-3 border-t px-5 py-4"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || clientsQuery.isPlaceholderData}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground text-xs font-medium">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  page >= pagination.totalPages ||
                  clientsQuery.isPlaceholderData
                }
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </nav>
          ) : null}
        </section>

        <section
          aria-live="polite"
          className={cn(
            "rounded-card border-border bg-card shadow-panel min-w-0 border",
            !isEditorOpen && "hidden lg:block",
          )}
        >
          {!isEditorOpen ? (
            <div className="grid min-h-96 place-items-center p-8 text-center">
              <div className="max-w-sm space-y-2">
                <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
                  Selecciona un cliente
                </h2>
                <p className="text-muted-foreground text-sm leading-6">
                  Consulta o actualiza su información desde este panel.
                </p>
              </div>
            </div>
          ) : selectedClientId && selectedClientQuery.isPending ? (
            <div aria-label="Cargando cliente" className="space-y-4 p-6">
              <div className="bg-muted h-7 w-40 animate-pulse rounded-md" />
              <div className="bg-muted h-48 animate-pulse rounded-md" />
            </div>
          ) : selectedClientId && selectedClientQuery.isError ? (
            <div className="space-y-4 p-6">
              <div className="border-danger space-y-2 border-l-2 pl-4">
                <h2 className="font-display text-lg font-semibold">
                  No pudimos cargar este cliente
                </h2>
                <p className="text-muted-foreground text-sm">
                  Revisa tu conexión o vuelve al directorio.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void selectedClientQuery.refetch()}
                >
                  Intentar de nuevo
                </Button>
                <Button variant="ghost" size="sm" onClick={closeEditor}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="border-border flex items-start justify-between gap-4 border-b p-5 sm:p-6">
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
                    {editor.mode === "create"
                      ? "Nuevo cliente"
                      : "Editar cliente"}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {editor.mode === "create"
                      ? "Registra la información esencial."
                      : "Actualiza los datos del directorio."}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={closeEditor}>
                  Cerrar
                </Button>
              </div>
              <div className="p-5 sm:p-6">
                <ClientForm
                  key={editor.mode === "edit" ? editor.client.id : "new"}
                  initialClient={
                    editor.mode === "edit" ? editor.client : undefined
                  }
                  onSubmit={
                    editor.mode === "create" ? createClient : updateClient
                  }
                  onCancel={closeEditor}
                />
              </div>
            </div>
          )}
        </section>
      </AppPageContent>
    </AppPage>
  );
}
