import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberIdentity } from "@/features/identity/member-identity";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useListTeamMembers } from "@/lib/api/generated/team/team";
import type { StudioMember } from "@/lib/api/generated/models";

export type InitialTeamSelection = {
  member: StudioMember;
  responsibility: "member" | "responsible";
};

export function ProjectInitialTeamSelector({
  value,
  onChange,
}: {
  value: InitialTeamSelection[];
  onChange(value: InitialTeamSelection[]): void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();
  const membersQuery = useListTeamMembers({
    page: 1,
    pageSize: 100,
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
  });
  const selectedUserIds = new Set(value.map(({ member }) => member.userId));
  const candidates = membersQuery.data?.members ?? [];

  function toggle(member: StudioMember) {
    if (selectedUserIds.has(member.userId)) {
      onChange(
        value.filter((selection) => selection.member.userId !== member.userId),
      );
      return;
    }
    onChange([...value, { member, responsibility: "member" }]);
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Añadir integrantes al proyecto"
            aria-expanded={open}
            className="h-11 w-full justify-between font-normal"
          >
            {value.length === 0
              ? "Añadir integrantes"
              : `${value.length} ${value.length === 1 ? "integrante" : "integrantes"}`}
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              aria-label="Buscar integrante"
              placeholder="Buscar por alias, nombre o correo"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-64 overscroll-contain">
              {membersQuery.isPending ? (
                <p
                  role="status"
                  className="text-muted-foreground px-3 py-6 text-center text-sm"
                >
                  Buscando integrantes…
                </p>
              ) : membersQuery.isError ? (
                <div className="space-y-2 px-3 py-4 text-center">
                  <p className="text-danger text-sm">
                    No pudimos cargar el equipo.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void membersQuery.refetch()}
                  >
                    Intentar de nuevo
                  </Button>
                </div>
              ) : candidates.length === 0 ? (
                <CommandEmpty>No encontramos integrantes.</CommandEmpty>
              ) : (
                <CommandGroup aria-label="Integrantes del estudio">
                  {candidates.map((member) => (
                    <CommandItem
                      key={member.userId}
                      value={member.userId}
                      onSelect={() => toggle(member)}
                    >
                      <Check
                        aria-hidden="true"
                        className={
                          selectedUserIds.has(member.userId)
                            ? "opacity-100"
                            : "opacity-0"
                        }
                      />
                      <MemberIdentity
                        focusable={false}
                        member={{
                          userId: member.userId,
                          alias: member.alias,
                          avatarColor: member.avatarColor,
                          fullName: member.name,
                        }}
                        secondary={member.email}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <ul className="divide-border rounded-control border-border divide-y border">
          {value.map((selection) => (
            <li
              key={selection.member.userId}
              className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center"
            >
              <MemberIdentity
                focusable={false}
                member={{
                  userId: selection.member.userId,
                  alias: selection.member.alias,
                  avatarColor: selection.member.avatarColor,
                  fullName: selection.member.name,
                }}
                secondary={selection.member.email}
              />
              <Select
                value={selection.responsibility}
                onValueChange={(responsibility) =>
                  onChange(
                    value.map((candidate) =>
                      candidate.member.userId === selection.member.userId
                        ? {
                            ...candidate,
                            responsibility:
                              responsibility as InitialTeamSelection["responsibility"],
                          }
                        : candidate,
                    ),
                  )
                }
              >
                <SelectTrigger
                  aria-label={`Rol de ${selection.member.name}`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Integrante</SelectItem>
                  <SelectItem value="responsible">Supervisor</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar a ${selection.member.name}`}
                onClick={() =>
                  onChange(
                    value.filter(
                      (candidate) =>
                        candidate.member.userId !== selection.member.userId,
                    ),
                  )
                }
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
