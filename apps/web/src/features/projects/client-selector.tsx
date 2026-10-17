import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useListClients } from "@/lib/api/generated/clients/clients";
import type { ProjectClient } from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";

type ClientSelectorProps = {
  id?: string;
  value: ProjectClient | null;
  onChange(client: ProjectClient): void;
  error?: string;
};

export function ClientSelector({
  id,
  value,
  onChange,
  error,
}: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();
  const clientsQuery = useListClients({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    page: 1,
    pageSize: 25,
  });
  const clients = clientsQuery.data?.clients ?? [];

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Cliente"
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            className="h-11 w-full justify-between font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value?.name ?? "Selecciona un cliente"}
            </span>
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              aria-label="Buscar cliente"
              placeholder="Buscar por nombre o documento"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-64 overscroll-contain">
              {clientsQuery.isPending ? (
                <p
                  role="status"
                  className="text-muted-foreground px-3 py-6 text-center text-sm"
                >
                  Buscando clientes…
                </p>
              ) : clientsQuery.isError ? (
                <div className="space-y-2 px-3 py-4 text-center">
                  <p className="text-danger text-sm">
                    No pudimos buscar clientes.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void clientsQuery.refetch()}
                  >
                    Intentar de nuevo
                  </Button>
                </div>
              ) : clients.length === 0 ? (
                <CommandEmpty>No encontramos clientes.</CommandEmpty>
              ) : (
                <CommandGroup aria-label="Resultados de clientes">
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.id}
                      onSelect={() => {
                        onChange({ id: client.id, name: client.name });
                        setOpen(false);
                      }}
                    >
                      <Check
                        aria-hidden="true"
                        className={cn(
                          "shrink-0",
                          client.id === value?.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {client.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {client.documentNumber ??
                          (client.type === "company" ? "Empresa" : "Persona")}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
