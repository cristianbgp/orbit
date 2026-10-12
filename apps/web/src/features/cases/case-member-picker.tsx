import { Check, ChevronsUpDown, X } from "lucide-react";
import { useRef, useState } from "react";

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
import { MemberIdentity } from "@/features/identity/member-identity";
import { groupStudioMembersByPosition } from "@/features/team/studio-member-position";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAllCaseMembers } from "./use-case-option-pages";

export function CaseMemberPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange(value: string[]): void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();
  const query = useAllCaseMembers(debouncedSearch);
  const members = query.data ?? [];
  const knownMembers = useRef(new Map<string, (typeof members)[number]>());
  for (const member of members) knownMembers.current.set(member.userId, member);
  const selected = value.flatMap((userId) => {
    const member = knownMembers.current.get(userId);
    return member ? [member] : [];
  });
  const memberGroups = groupStudioMembersByPosition(
    members,
    (member) => member.position,
  );
  const selectedGroups = groupStudioMembersByPosition(
    selected,
    (member) => member.position,
  );

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Añadir miembros al caso"
            aria-expanded={open}
            className="h-11 w-full justify-between font-normal"
          >
            {value.length
              ? `${value.length} ${value.length === 1 ? "miembro seleccionado" : "miembros seleccionados"}`
              : "Añadir miembros"}
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar por alias, nombre o correo"
            />
            <CommandList className="max-h-64 overscroll-contain">
              {query.isPending ? (
                <p
                  role="status"
                  className="text-muted-foreground px-3 py-6 text-center text-sm"
                >
                  Buscando miembros…
                </p>
              ) : query.isError ? (
                <p className="text-danger px-3 py-6 text-center text-sm">
                  No pudimos cargar el equipo.
                </p>
              ) : members.length === 0 ? (
                <CommandEmpty>No encontramos miembros.</CommandEmpty>
              ) : (
                memberGroups.map((group) => (
                  <CommandGroup
                    key={group.label}
                    heading={group.label}
                    aria-label={group.label}
                  >
                    {group.members.map((member) => (
                      <CommandItem
                        key={member.userId}
                        value={member.userId}
                        onSelect={() =>
                          onChange(
                            value.includes(member.userId)
                              ? value.filter((id) => id !== member.userId)
                              : [...value, member.userId],
                          )
                        }
                      >
                        <Check
                          aria-hidden="true"
                          className={
                            value.includes(member.userId)
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
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length ? (
        <div className="space-y-3">
          {selectedGroups.map((group) => (
            <section key={group.label} role="group" aria-label={group.label}>
              <h3 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
                {group.label}
              </h3>
              <ul className="divide-border rounded-control border-border divide-y border">
                {group.members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex min-w-0 items-center gap-3 p-3"
                  >
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar a ${member.name}`}
                      className="ml-auto shrink-0"
                      onClick={() =>
                        onChange(value.filter((id) => id !== member.userId))
                      }
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
